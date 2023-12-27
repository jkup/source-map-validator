package original

fun wat(msg: String, fn: (String) -> Unit) =
  foo(fn, msg)

fun main() = wat("boop") {
  throw IllegalStateException(it)
}