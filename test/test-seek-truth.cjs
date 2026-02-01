const { ethers } = require("hardhat");

async function main() {
    console.log("Testing seekTruth function...\n");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Get deployed contract address
    const deploymentInfo = require("../deploy/deployment-info.json");
    console.log("Contract address:", deploymentInfo.address);

    // Attach to contract
    const Contract = await ethers.getContractFactory("CloudDreamProtocol");
    const contract = Contract.attach(deploymentInfo.address);

    // Get balance before
    const balanceBefore = await ethers.provider.getBalance(signer.address);
    console.log("Balance before:", ethers.formatEther(balanceBefore), "ETH\n");

    try {
        // Call seekTruth
        console.log("Calling seekTruth with wish: '测试祈愿'...");
        const tx = await contract.seekTruth("测试祈愿", {
            value: ethers.parseEther("0.001"),
            gasLimit: 500000
        });

        console.log("Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ Transaction confirmed!");
        console.log("Block number:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Parse events
        const events = receipt.logs
            .map(log => {
                try {
                    return contract.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            })
            .filter(event => event !== null);

        console.log("\nEvents emitted:");
        events.forEach(event => {
            console.log(`- ${event.name}`);
            if (event.name === "SeekResult") {
                console.log("  User:", event.args.user);
                console.log("  Tier:", event.args.tier);
                console.log("  Reward:", ethers.formatEther(event.args.reward), "ETH");
                console.log("  Wish Text:", event.args.wishText);
            }
        });

        // Get balance after
        const balanceAfter = await ethers.provider.getBalance(signer.address);
        console.log("\nBalance after:", ethers.formatEther(balanceAfter), "ETH");
        console.log("Cost:", ethers.formatEther(balanceBefore - balanceAfter), "ETH");

        // Get tribulation count
        const tribCount = await contract.userTribulationCount(signer.address);
        console.log("\nUser tribulation count:", tribCount.toString());

    } catch (error) {
        console.error("\n❌ Transaction failed:");
        console.error(error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
