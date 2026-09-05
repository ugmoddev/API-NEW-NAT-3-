#include "../../src/vpnmanager/vpnmanager_command.h"

#include <assert.h>
#include <string.h>

static void test_operation(const char *line, VM_OPERATION_KIND kind, uint32_t id)
{
    VM_COMMAND command;
    assert(vm_parse_command(line, &command) == 1);
    assert(command.kind == VM_COMMAND_OPERATION);
    assert(command.operation == kind);
    assert(command.profile_id == id);
}

int main(void)
{
    VM_COMMAND command;
    test_operation("vpn connect 3", VM_OP_CONNECT, 3);
    test_operation("vpn switch 5", VM_OP_SWITCH, 5);
    test_operation("vpn disconnect", VM_OP_DISCONNECT, 0);
    assert(vm_parse_command("vpn list", &command) == 1 && command.kind == VM_COMMAND_LIST);
    assert(vm_parse_command("vpn status", &command) == 1 && command.kind == VM_COMMAND_STATUS);
    assert(vm_parse_command("vpn fastest", &command) == 1 && command.kind == VM_COMMAND_FASTEST);
    assert(vm_parse_command("vpn speedtest 2", &command) == 1 && command.kind == VM_COMMAND_SPEEDTEST);
    assert(vm_parse_command("vpn connect 0", &command) == 0);
    assert(vm_parse_command("vpn connect 3 trailing", &command) == 0);
    assert(vm_parse_command("vpn connect 3x", &command) == 0);
    assert(vm_parse_command("vpn disconnect 1", &command) == 0);
    assert(vm_parse_command("vpn rm 1", &command) == 0);
    return 0;
}
