#include "../../src/vpnmanager/vpnmanager.h"

#include <assert.h>
#include <stdio.h>
#include <string.h>

static VM_PROFILE profile(uint32_t id, const char *name)
{
    VM_PROFILE p;
    memset(&p, 0, sizeof(p));
    p.id = id;
    snprintf(p.name, sizeof(p.name), "%s", name);
    snprintf(p.server, sizeof(p.server), "vpn-%u.example.test", (unsigned)id);
    p.port = 443;
    snprintf(p.protocol, sizeof(p.protocol), "softether");
    snprintf(p.username, sizeof(p.username), "user");
    snprintf(p.credential_reference, sizeof(p.credential_reference), "windows:softether/%u", (unsigned)id);
    p.status = VM_DISCONNECTED;
    return p;
}

static void test_validation(void)
{
    VM_PROFILE p = profile(1, "Japan");
    char error[128];
    assert(vm_profile_validate(&p, error, sizeof(error)) == 1);
    p.credential_reference[0] = '\0';
    assert(vm_profile_validate(&p, error, sizeof(error)) == 0);
    assert(strstr(error, "credential") != NULL);
}

static void test_speed_boundaries(void)
{
    assert(vm_classify_download(19.99) == VM_SPEED_SLOW);
    assert(vm_classify_download(20.0) == VM_SPEED_MEDIUM);
    assert(vm_classify_download(49.99) == VM_SPEED_MEDIUM);
    assert(vm_classify_download(50.0) == VM_SPEED_GOOD);
    assert(vm_classify_download(99.99) == VM_SPEED_GOOD);
    assert(vm_classify_download(100.0) == VM_SPEED_HIGH);
}

static void test_serialized_queue(void)
{
    VM_MANAGER manager;
    VM_OPERATION op;
    VM_PROFILE p1 = profile(1, "Singapore");
    VM_PROFILE p2 = profile(2, "Japan");
    vm_manager_init(&manager);
    assert(vm_manager_add_profile(&manager, &p1) == 1);
    assert(vm_manager_add_profile(&manager, &p2) == 1);
    assert(vm_manager_enqueue(&manager, VM_OP_SWITCH, 1) == 1);
    assert(vm_manager_enqueue(&manager, VM_OP_SWITCH, 2) == 1);
    assert(vm_manager_begin_next(&manager, &op) == 1);
    assert(op.profile_id == 1);
    assert(manager.status == VM_SWITCHING);
    assert(vm_manager_begin_next(&manager, NULL) == 0);
    vm_manager_finish(&manager, VM_CONNECTED);
    assert(manager.current_profile_id == 1);
    assert(vm_manager_begin_next(&manager, &op) == 1);
    assert(op.profile_id == 2);
    vm_manager_finish(&manager, VM_CONNECTED);
    assert(manager.current_profile_id == 2);
    assert(!vm_manager_has_pending(&manager));
}

static void test_rapid_hotkeys_are_serialized(void)
{
    VM_MANAGER manager;
    VM_OPERATION op;
    VM_PROFILE p1 = profile(1, "Singapore");
    VM_PROFILE p2 = profile(2, "Japan");
    VM_PROFILE p3 = profile(3, "Germany");
    vm_manager_init(&manager);
    assert(vm_manager_add_profile(&manager, &p1) == 1);
    assert(vm_manager_add_profile(&manager, &p2) == 1);
    assert(vm_manager_add_profile(&manager, &p3) == 1);
    assert(vm_manager_enqueue(&manager, VM_OP_SWITCH, 1) == 1);
    assert(vm_manager_enqueue(&manager, VM_OP_SWITCH, 2) == 1);
    assert(vm_manager_enqueue(&manager, VM_OP_SWITCH, 3) == 1);
    assert(vm_manager_begin_next(&manager, &op) == 1 && op.profile_id == 1);
    assert(vm_manager_begin_next(&manager, NULL) == 0);
    vm_manager_finish(&manager, VM_CONNECTED);
    assert(vm_manager_begin_next(&manager, &op) == 1 && op.profile_id == 2);
    vm_manager_finish(&manager, VM_CONNECTED);
    assert(vm_manager_begin_next(&manager, &op) == 1 && op.profile_id == 3);
    vm_manager_finish(&manager, VM_CONNECTED);
    assert(manager.current_profile_id == 3);
}

static void test_invalid_operation_is_rejected(void)
{
    VM_MANAGER manager;
    vm_manager_init(&manager);
    assert(vm_manager_enqueue(&manager, VM_OP_CONNECT, 99) == 0);
    assert(vm_manager_enqueue(&manager, VM_OP_DISCONNECT, 0) == 1);
}

int main(void)
{
    test_validation();
    test_speed_boundaries();
    test_serialized_queue();
    test_rapid_hotkeys_are_serialized();
    test_invalid_operation_is_rejected();
    puts("vpnmanager tests: PASS");
    return 0;
}
