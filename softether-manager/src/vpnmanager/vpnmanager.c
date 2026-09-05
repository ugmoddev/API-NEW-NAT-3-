#include "vpnmanager.h"

#include <stdio.h>
#include <string.h>

static int vm_set_error(char *error, size_t error_size, const char *message)
{
    if (error != NULL && error_size > 0)
    {
        (void)snprintf(error, error_size, "%s", message);
    }
    return 0;
}

static int vm_string_nonempty(const char *value)
{
    return value != NULL && value[0] != '\0';
}

void vm_manager_init(VM_MANAGER *manager)
{
    if (manager == NULL)
    {
        return;
    }
    memset(manager, 0, sizeof(*manager));
    manager->status = VM_DISCONNECTED;
    manager->next_sequence = 1;
}

int vm_profile_validate(const VM_PROFILE *profile, char *error, size_t error_size)
{
    if (profile == NULL)
    {
        return vm_set_error(error, error_size, "profile is null");
    }
    if (profile->id == 0)
    {
        return vm_set_error(error, error_size, "profile id must be non-zero");
    }
    if (!vm_string_nonempty(profile->name))
    {
        return vm_set_error(error, error_size, "profile name is required");
    }
    if (!vm_string_nonempty(profile->server))
    {
        return vm_set_error(error, error_size, "profile server is required");
    }
    if (profile->port == 0)
    {
        return vm_set_error(error, error_size, "profile port must be non-zero");
    }
    if (!vm_string_nonempty(profile->protocol))
    {
        return vm_set_error(error, error_size, "profile protocol is required");
    }
    if (!vm_string_nonempty(profile->credential_reference))
    {
        return vm_set_error(error, error_size, "credential reference is required");
    }
    if (profile->metrics.download_mbps < 0.0 || profile->metrics.upload_mbps < 0.0 ||
        profile->metrics.packet_loss_percent < 0.0 || profile->metrics.packet_loss_percent > 100.0)
    {
        return vm_set_error(error, error_size, "metrics contain an invalid value");
    }
    if (error != NULL && error_size > 0)
    {
        error[0] = '\0';
    }
    return 1;
}

int vm_manager_add_profile(VM_MANAGER *manager, const VM_PROFILE *profile)
{
    size_t i;
    if (manager == NULL || profile == NULL || manager->profile_count >= VM_MAX_PROFILES)
    {
        return 0;
    }
    if (!vm_profile_validate(profile, NULL, 0))
    {
        return 0;
    }
    for (i = 0; i < manager->profile_count; ++i)
    {
        if (manager->profiles[i].id == profile->id)
        {
            return 0;
        }
    }
    manager->profiles[manager->profile_count++] = *profile;
    return 1;
}

const VM_PROFILE *vm_manager_find_profile(const VM_MANAGER *manager, uint32_t profile_id)
{
    size_t i;
    if (manager == NULL)
    {
        return NULL;
    }
    for (i = 0; i < manager->profile_count; ++i)
    {
        if (manager->profiles[i].id == profile_id)
        {
            return &manager->profiles[i];
        }
    }
    return NULL;
}

int vm_manager_remove_profile(VM_MANAGER *manager, uint32_t profile_id)
{
    size_t i;
    if (manager == NULL || manager->current_profile_id == profile_id)
    {
        return 0;
    }
    for (i = 0; i < manager->profile_count; ++i)
    {
        if (manager->profiles[i].id == profile_id)
        {
            memmove(&manager->profiles[i], &manager->profiles[i + 1],
                    (manager->profile_count - i - 1) * sizeof(VM_PROFILE));
            --manager->profile_count;
            return 1;
        }
    }
    return 0;
}

VM_SPEED_CLASS vm_classify_download(double mbps)
{
    if (mbps >= 100.0) return VM_SPEED_HIGH;
    if (mbps >= 50.0) return VM_SPEED_GOOD;
    if (mbps >= 20.0) return VM_SPEED_MEDIUM;
    return VM_SPEED_SLOW;
}

const char *vm_speed_class_name(VM_SPEED_CLASS speed_class)
{
    switch (speed_class)
    {
    case VM_SPEED_HIGH: return "HIGH SPEED";
    case VM_SPEED_GOOD: return "GOOD";
    case VM_SPEED_MEDIUM: return "MEDIUM";
    default: return "SLOW";
    }
}

const char *vm_status_name(VM_STATUS status)
{
    switch (status)
    {
    case VM_CONNECTING: return "CONNECTING";
    case VM_CONNECTED: return "CONNECTED";
    case VM_DISCONNECTING: return "DISCONNECTING";
    case VM_SWITCHING: return "SWITCHING";
    case VM_CONNECT_FAILED: return "CONNECT_FAILED";
    case VM_DISCONNECT_FAILED: return "DISCONNECT_FAILED";
    case VM_TIMEOUT: return "TIMEOUT";
    case VM_AUTH_FAILED: return "AUTH_FAILED";
    case VM_SERVER_UNAVAILABLE: return "SERVER_UNAVAILABLE";
    default: return "DISCONNECTED";
    }
}

static int vm_operation_valid(const VM_MANAGER *manager, VM_OPERATION_KIND kind, uint32_t profile_id)
{
    if (manager == NULL) return 0;
    if ((kind == VM_OP_CONNECT || kind == VM_OP_SWITCH) && vm_manager_find_profile(manager, profile_id) == NULL)
    {
        return 0;
    }
    return kind == VM_OP_DISCONNECT || kind == VM_OP_CONNECT || kind == VM_OP_SWITCH;
}

int vm_manager_enqueue(VM_MANAGER *manager, VM_OPERATION_KIND kind, uint32_t profile_id)
{
    VM_OPERATION *operation;
    if (!vm_operation_valid(manager, kind, profile_id) || manager->queue_count >= VM_MAX_QUEUE)
    {
        return 0;
    }
    operation = &manager->queue[manager->queue_count++];
    operation->kind = kind;
    operation->profile_id = profile_id;
    operation->sequence = manager->next_sequence++;
    return 1;
}

int vm_manager_dequeue(VM_MANAGER *manager, VM_OPERATION *operation)
{
    if (manager == NULL || operation == NULL || manager->queue_count == 0)
    {
        return 0;
    }
    *operation = manager->queue[0];
    memmove(&manager->queue[0], &manager->queue[1],
            (manager->queue_count - 1) * sizeof(VM_OPERATION));
    --manager->queue_count;
    return 1;
}

int vm_manager_begin_next(VM_MANAGER *manager, VM_OPERATION *operation)
{
    if (manager == NULL || manager->operation_active)
    {
        return 0;
    }
    if (!vm_manager_dequeue(manager, &manager->active_operation))
    {
        return 0;
    }
    manager->operation_active = 1;
    if (manager->active_operation.kind == VM_OP_SWITCH)
    {
        manager->status = VM_SWITCHING;
    }
    else if (manager->active_operation.kind == VM_OP_CONNECT)
    {
        manager->status = VM_CONNECTING;
    }
    else
    {
        manager->status = VM_DISCONNECTING;
    }
    if (operation != NULL)
    {
        *operation = manager->active_operation;
    }
    return 1;
}

void vm_manager_finish(VM_MANAGER *manager, VM_STATUS result)
{
    if (manager == NULL || !manager->operation_active)
    {
        return;
    }
    manager->operation_active = 0;
    manager->status = result;
    if (result == VM_CONNECTED)
    {
        manager->current_profile_id = manager->active_operation.profile_id;
    }
    else if (result == VM_DISCONNECTED)
    {
        manager->current_profile_id = 0;
    }
    memset(&manager->active_operation, 0, sizeof(manager->active_operation));
}

int vm_manager_has_pending(const VM_MANAGER *manager)
{
    return manager != NULL && manager->queue_count > 0;
}
