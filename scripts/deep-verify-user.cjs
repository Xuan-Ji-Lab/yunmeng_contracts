const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x73b39883178bbea38a9c88e4a27c706e63af7b2835058fcf6d6376cb6a6a9344";
    const targetUser = "0x4d1CD4c6f9c75Be993bCe42e254AD73fbb121D36"; // The one we think is contract

    console.log(`Analyzing Tx: ${txHash}`);

    const provider = ethers.provider;
    const tx = await provider.getTransaction(txHash);

    console.log("Tx From:", tx.from);
    console.log("Target User:", targetUser);
    console.log("Match?", tx.from.toLowerCase() === targetUser.toLowerCase());

    const code = await provider.getCode(targetUser);
    console.log(`Code at ${targetUser}: ${code}`);

    if (code === "0x") {
        console.log("CONCLUSION: EOA (No Code)");
    } else {
        console.log(`CONCLUSION: CONTRACT (Len: ${code.length})`);
        // 48 bytes often implies a minimal proxy or specific wallet type
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
