const hre = require("hardhat");

/**
 * 提取所有选择器 from 0xAA09...
 */
async function main() {
    const TARGET = "0xAA0930e9AB7b0580b4e7F6A7082FFa101Ca62a14";
    console.log("Analyzing 0xAA09... :", TARGET);

    const code = await hre.ethers.provider.getCode(TARGET);
    if (code === "0x") {
        console.error("No code found at 0xAA09...!");
        return;
    }

    const regex = /63([0-9a-f]{8})14/g;
    let match;
    const selectors = new Set();

    while ((match = regex.exec(code.slice(2))) !== null) {
        selectors.add("0x" + match[1]);
    }

    console.log(`Found ${selectors.size} selectors:`);
    const sorted = Array.from(selectors).sort();

    for (const sel of sorted) {
        console.log(sel);
    }

    // Check if 0x2f71b237 is present
    if (selectors.has("0x2f71b237")) {
        console.log("\n✅ Confirmed: Contract contains target selector '0x2f71b237'!");
    } else {
        console.log("\n⚠️ Warning: '0x2f71b237' NOT found in standard dispatcher.");
    }
}

main().catch(console.error);
