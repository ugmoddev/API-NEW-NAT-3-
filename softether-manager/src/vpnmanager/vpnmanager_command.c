#include "vpnmanager_command.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

static const char *skip_space(const char *p)
{
    while (*p != '\0' && isspace((unsigned char)*p)) ++p;
    return p;
}

static int read_word(const char **cursor, char *word, size_t word_size)
{
    const char *p = skip_space(*cursor);
    size_t length = 0;
    if (*p == '\0') return 0;
    while (*p != '\0' && !isspace((unsigned char)*p))
    {
        if (length + 1 >= word_size) return 0;
        word[length++] = *p++;
    }
    word[length] = '\0';
    *cursor = p;
    return 1;
}

static int read_profile_id(const char **cursor, uint32_t *profile_id)
{
    char word[32];
    char extra;
    unsigned long value;
    if (!read_word(cursor, word, sizeof(word))) return 0;
    if (sscanf(word, "%lu%c", &value, &extra) != 1 || value == 0 || value > 0xffffffffUL)
    {
        return 0;
    }
    if (*skip_space(*cursor) != '\0') return 0;
    *profile_id = (uint32_t)value;
    return 1;
}

int vm_parse_command(const char *line, VM_COMMAND *command)
{
    const char *cursor;
    char noun[32];
    char verb[32];
    if (line == NULL || command == NULL) return 0;
    memset(command, 0, sizeof(*command));
    cursor = line;
    if (!read_word(&cursor, noun, sizeof(noun))) return 0;
    if (strcmp(noun, "vpn") != 0 && strcmp(noun, "vpn-manager") != 0) return 0;
    if (!read_word(&cursor, verb, sizeof(verb))) return 0;
    if (strcmp(verb, "list") == 0 && *skip_space(cursor) == '\0')
    {
        command->kind = VM_COMMAND_LIST;
        return 1;
    }
    if (strcmp(verb, "status") == 0 && *skip_space(cursor) == '\0')
    {
        command->kind = VM_COMMAND_STATUS;
        return 1;
    }
    if (strcmp(verb, "fastest") == 0 && *skip_space(cursor) == '\0')
    {
        command->kind = VM_COMMAND_FASTEST;
        return 1;
    }
    if (strcmp(verb, "connect") == 0 || strcmp(verb, "switch") == 0 || strcmp(verb, "speedtest") == 0)
    {
        if (!read_profile_id(&cursor, &command->profile_id)) return 0;
        command->kind = strcmp(verb, "speedtest") == 0 ? VM_COMMAND_SPEEDTEST : VM_COMMAND_OPERATION;
        command->operation = strcmp(verb, "connect") == 0 ? VM_OP_CONNECT : VM_OP_SWITCH;
        return 1;
    }
    if (strcmp(verb, "disconnect") == 0 && *skip_space(cursor) == '\0')
    {
        command->kind = VM_COMMAND_OPERATION;
        command->operation = VM_OP_DISCONNECT;
        return 1;
    }
    return 0;
}
