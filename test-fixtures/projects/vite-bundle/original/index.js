import { foo } from './foo.js';

function wat(fn, msg) {
  foo(fn, msg);
}

wat(function hello(msg) {
  throw new Error(msg);
}, 'boop');
