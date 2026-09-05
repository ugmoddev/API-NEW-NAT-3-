CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic

TARGET := vpnmanager-tests
COMMAND_TARGET := vpnmanager-command-tests
SOURCES := ../../src/vpnmanager/vpnmanager.c test_vpnmanager.c
COMMAND_SOURCES := ../../src/vpnmanager/vpnmanager_command.c test_command.c

.PHONY: all test clean

all: $(TARGET) $(COMMAND_TARGET)

test: $(TARGET) $(COMMAND_TARGET)
	./$(TARGET)
	./$(COMMAND_TARGET)

$(TARGET): $(SOURCES) ../../src/vpnmanager/vpnmanager.h
	$(CC) $(CFLAGS) -I../../src/vpnmanager $(SOURCES) -o $@

$(COMMAND_TARGET): $(COMMAND_SOURCES) ../../src/vpnmanager/vpnmanager_command.h ../../src/vpnmanager/vpnmanager.h
	$(CC) $(CFLAGS) -I../../src/vpnmanager $(COMMAND_SOURCES) -o $@

clean:
	rm -f $(TARGET) $(COMMAND_TARGET)
