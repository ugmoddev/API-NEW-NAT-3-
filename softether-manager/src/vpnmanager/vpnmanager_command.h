#ifndef SOFTETHER_VPNMANAGER_COMMAND_H
#define SOFTETHER_VPNMANAGER_COMMAND_H

#include "vpnmanager.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum VM_COMMAND_KIND {
    VM_COMMAND_INVALID = 0,
    VM_COMMAND_LIST,
    VM_COMMAND_STATUS,
    VM_COMMAND_SPEEDTEST,
    VM_COMMAND_FASTEST,
    VM_COMMAND_OPERATION
} VM_COMMAND_KIND;

typedef struct VM_COMMAND {
    VM_COMMAND_KIND kind;
    VM_OPERATION_KIND operation;
    uint32_t profile_id;
} VM_COMMAND;

int vm_parse_command(const char *line, VM_COMMAND *command);

#ifdef __cplusplus
}
#endif

#endif
