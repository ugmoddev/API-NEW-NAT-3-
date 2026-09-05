#ifndef SOFTETHER_VPNMANAGER_H
#define SOFTETHER_VPNMANAGER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define VM_MAX_PROFILES 256
#define VM_MAX_QUEUE 64
#define VM_NAME_MAX 128
#define VM_SERVER_MAX 256
#define VM_PROTOCOL_MAX 32
#define VM_CREDENTIAL_REF_MAX 256

typedef enum VM_STATUS {
    VM_DISCONNECTED = 0,
    VM_CONNECTING,
    VM_CONNECTED,
    VM_DISCONNECTING,
    VM_SWITCHING,
    VM_CONNECT_FAILED,
    VM_DISCONNECT_FAILED,
    VM_TIMEOUT,
    VM_AUTH_FAILED,
    VM_SERVER_UNAVAILABLE
} VM_STATUS;

typedef enum VM_OPERATION_KIND {
    VM_OP_DISCONNECT = 0,
    VM_OP_CONNECT,
    VM_OP_SWITCH
} VM_OPERATION_KIND;

typedef enum VM_SPEED_CLASS {
    VM_SPEED_SLOW = 0,
    VM_SPEED_MEDIUM,
    VM_SPEED_GOOD,
    VM_SPEED_HIGH
} VM_SPEED_CLASS;

typedef struct VM_METRICS {
    int ping_ms;
    double download_mbps;
    double upload_mbps;
    double jitter_ms;
    double packet_loss_percent;
    uint64_t measured_at_unix;
} VM_METRICS;

typedef struct VM_PROFILE {
    uint32_t id;
    char name[VM_NAME_MAX];
    char server[VM_SERVER_MAX];
    uint16_t port;
    char protocol[VM_PROTOCOL_MAX];
    char username[VM_NAME_MAX];
    char credential_reference[VM_CREDENTIAL_REF_MAX];
    uint64_t created_at_unix;
    uint64_t last_connected_unix;
    VM_METRICS metrics;
    VM_STATUS status;
} VM_PROFILE;

typedef struct VM_OPERATION {
    VM_OPERATION_KIND kind;
    uint32_t profile_id;
    uint64_t sequence;
} VM_OPERATION;

typedef struct VM_MANAGER {
    VM_PROFILE profiles[VM_MAX_PROFILES];
    size_t profile_count;
    VM_STATUS status;
    uint32_t current_profile_id;
    uint64_t next_sequence;
    VM_OPERATION queue[VM_MAX_QUEUE];
    size_t queue_count;
    int operation_active;
    VM_OPERATION active_operation;
} VM_MANAGER;

void vm_manager_init(VM_MANAGER *manager);
int vm_profile_validate(const VM_PROFILE *profile, char *error, size_t error_size);
int vm_manager_add_profile(VM_MANAGER *manager, const VM_PROFILE *profile);
const VM_PROFILE *vm_manager_find_profile(const VM_MANAGER *manager, uint32_t profile_id);
int vm_manager_remove_profile(VM_MANAGER *manager, uint32_t profile_id);

VM_SPEED_CLASS vm_classify_download(double mbps);
const char *vm_speed_class_name(VM_SPEED_CLASS speed_class);
const char *vm_status_name(VM_STATUS status);

int vm_manager_enqueue(VM_MANAGER *manager, VM_OPERATION_KIND kind, uint32_t profile_id);
int vm_manager_dequeue(VM_MANAGER *manager, VM_OPERATION *operation);
int vm_manager_begin_next(VM_MANAGER *manager, VM_OPERATION *operation);
void vm_manager_finish(VM_MANAGER *manager, VM_STATUS result);
int vm_manager_has_pending(const VM_MANAGER *manager);

#ifdef __cplusplus
}
#endif

#endif
