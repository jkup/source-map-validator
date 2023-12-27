package original

fun wat(signal: Int, fn: (Int) -> Unit) =
  foo(fn, signal)

fun main() = wat(42) { }