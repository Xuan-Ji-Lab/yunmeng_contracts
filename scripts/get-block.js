const { ethers } = require("hardhat");

async function main() {
    const block = await ethers.provider.getBlockNumber();
    console.log("Current Block:", block);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
