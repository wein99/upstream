#include <errno.h>
#include <unistd.h>

#if !defined(__aarch64__) || !defined(__ANDROID__)
#error This compatibility library requires Android ARM64.
#endif

__attribute__((visibility("hidden"))) long syscallFailure(long result) {
  errno = (int)-result;
  return -1;
}

__attribute__((visibility("hidden"))) long unsupportedCloseRange(void) {
  errno = ENOSYS;
  return -1;
}

// ACT: Bun 1.4.2 calls libc syscall(close_range) before main. Android can trap
// this optional syscall instead of returning ENOSYS (oven-sh/bun#30766).
// Preserve the ARM64 variadic ABI and libc errno semantics for every other call.
// No signal handlers or seccomp policies are changed.
__asm__(
  ".text\n"
  ".global syscall\n"
  ".type syscall,%function\n"
  "syscall:\n"
  "cmp x0, #436\n"
  "b.eq unsupportedCloseRange\n"
  "mov x8, x0\n"
  "mov x0, x1\n"
  "mov x1, x2\n"
  "mov x2, x3\n"
  "mov x3, x4\n"
  "mov x4, x5\n"
  "mov x5, x6\n"
  "svc #0\n"
  "cmn x0, #4095\n"
  "b.cs syscallFailure\n"
  "ret\n"
  ".size syscall, .-syscall\n"
);

__attribute__((constructor)) static void announceCompatibility(void) {
  static const char message[] = "Lu aiTV: Android close_range compatibility active\n";
  write(STDERR_FILENO, message, sizeof(message) - 1);
}
