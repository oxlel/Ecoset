var arr = process.argv;
arr.splice(0, 2);

console.log(arr.join(" "));
process.exit(0);