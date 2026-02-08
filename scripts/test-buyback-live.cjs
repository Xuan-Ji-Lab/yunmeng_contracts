const hre = require("hardhat");

async function main() {
    const TREASURY = "0xf261e933e404427c81fb4e8D936772b113BC03Ea";
    const [deployer] = await hre.ethers.getSigners();

    console.log(`Testing Buyback on ${TREASURY}...`);

    const treasury = await hre.ethers.getContractAt("DreamTreasury", TREASURY);

    // 1. Send some BNB to Treasury
    const amount = hre.ethers.parseEther("0.0001");
    // const txSend = await deployer.sendTransaction({
    //     to: TREASURY,
    //     value: amount
    // });
    // await txSend.wait();
    // console.log("Sent 0.0001 BNB to Treasury");

    // Check balance
    const bal = await hre.ethers.provider.getBalance(TREASURY);
    console.log("Treasury Balance:", hre.ethers.formatEther(bal));

    if (bal < amount) {
        console.log("Sending funds...");
        const txSend = await deployer.sendTransaction({
            to: TREASURY,
            value: amount
        });
        await txSend.wait();
    }

    console.log("Treasury Portal:", await treasury.flapPortal());

    // 2. Execute Buyback (Small amount)
    console.log("Executing buyback (0.0001 BNB)...");
    const smallAmount = hre.ethers.parseEther("0.0001");
    try {
        const tx = await treasury.executeBuyback(smallAmount, { gasLimit: 5000000 });
        console.log("Tx Sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Buyback Executed!");

        // Find logs
        for (const log of receipt.logs) {
            try {
                const parsed = treasury.interface.parseLog(log);
                if (parsed.name === "BuybackExecuted") {
                    console.log(`Event: BuybackExecuted(BNB: ${hre.ethers.formatEther(parsed.args[0])}, WISH: ${hre.ethers.formatEther(parsed.args[1])})`);
                }
                if (parsed.name === "BuybackFailed") {
                    console.log(`Event: BuybackFailed(${parsed.args[0]})`);
                }
                if (parsed.name === "BuybackFailedBytes") {
                    console.log(`Event: BuybackFailedBytes(${parsed.args[0]})`);
                    // Try decode
                    try {
                        const err = hre.ethers.AbiCoder.defaultAbiCoder().decode(["string"], parsed.args[0].slice(4));
                        console.log("Decoded String:", err[0]);
                    } catch { }
                }
            } catch (e) { }
        }
    } catch (e) {
        console.error("Execution failed:", e.message);
        if (e.data) console.error("Data:", e.data);
    }
}

main().catch(console.error);
