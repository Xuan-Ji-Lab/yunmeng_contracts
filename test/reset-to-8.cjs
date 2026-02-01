const { ethers } = require("hardhat");

async function main() {
    console.log("🌊 Resetting to Tribulation Count 8...\n");

    const [signer] = await ethers.getSigners();
    console.log("User:", signer.address);

    const deploymentInfo = require("../deploy/deployment-info.json");
    const Contract = await ethers.getContractFactory("CloudDreamProtocol");
    const contract = Contract.attach(deploymentInfo.address);

    const currentCount = Number(await contract.userTribulationCount(signer.address));
    console.log("Current Count:", currentCount);

    // Calculate wishes needed to reach 8
    // Target is 8.
    // If current is 0 -> 8
    // If current is 8 -> 0 (but maybe user wants to cycle? Let's assume if it's 8, they want 0 cycles usually, but if they asked for reset, maybe they want a fresh 8)
    // Let's assume if current != 8, we go to 8.
    // If current == 8, we warn.

    let needed = 0;
    if (currentCount < 8) {
        needed = 8 - currentCount;
    } else if (currentCount > 8) {
        // Should not happen as max is 8 (9 resets to 0), but just in case of weird logic
        needed = (9 - currentCount) + 8;
    } else {
        // Current is 8. 
        console.log("Already at 8. Performing 9 wishes to cycle around and stack more weight? (y/n default y)");
        // For script simplicity, let's just cycle 9 times to "reset" the attempt
        needed = 9;
    }

    if (needed > 0) {
        console.log(`Executing ${needed} wishes to reach 8...`);
        for (let i = 0; i < needed; i++) {
            const tx = await contract.seekTruth(`Reset Wish ${i + 1}`, { value: ethers.parseEther("0.001") });
            await tx.wait();
            process.stdout.write(".");
        }
        console.log("\nDone.");
    }

    const newCount = await contract.userTribulationCount(signer.address);
    const weight = await contract.userTribulationWeight(signer.address);
    console.log("--------------------------------");
    console.log("✅ Ready for Testing");
    console.log("Tribulation Count:", Number(newCount));
    console.log("Total Weight:", Number(weight));
    console.log("👉 Go to UI and click 'Pray' (Prayer #9) to trigger Pity.");
}

main().catch(console.error);
