const sha = process.env.GITHUB_SHA;
if (!sha) {
  console.error("GITHUB_SHA is required");
  process.exit(1);
}

const deadline = Date.now() + 3 * 60 * 1000;
let last = "";

while (Date.now() < deadline) {
  const url = `https://www.bulkskart.com/version.json?t=${Date.now()}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    last = await response.text();
    console.log(last);
    if (!response.ok) {
      console.log(`HTTP ${response.status}`);
    } else {
      const data = JSON.parse(last);
      if (data.gitCommit === sha) {
        console.log(`Live site is serving ${sha}`);
        process.exit(0);
      }
    }
  } catch (error) {
    console.log(`poll error: ${error}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}

console.error(`version.json did not report ${sha} within 3 minutes`);
console.error(last);
process.exit(1);
