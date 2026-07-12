const { fetch } = require("next/dist/compiled/undici");
try {
  fetch("https://google.com ");
} catch (e) {
  console.log(e.name, e.message);
}
