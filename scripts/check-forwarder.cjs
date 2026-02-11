const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x0272d8f15322041e5ed0dd7015708b9F620f2BDf";
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);

    const forwarder = await treasury.automationForwarder();
    console.log("Contract Forwarder Address:", forwarder);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
