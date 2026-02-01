const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🌟 Starting Karma Boost Script...");

    // 1. Get deployment info
    const deploymentPath = path.join(__dirname, "../deploy/deployment-info.json");
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("❌ Deployment info not found at " + deploymentPath);
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contractAddress = deploymentInfo.address;
    console.log(`📍 Contract Address: ${contractAddress}`);

    // 2. Get Signers
    // We assume the first signer is the "User" who needs Karma.
    // The subsequent signers will act as "Friends" resonating with the User.
    const signers = await hre.ethers.getSigners();
    const targetUser = signers[0];
    const friends = signers.slice(1, 11); // Get 10 friends

    console.log(`🎯 Target User: ${targetUser.address}`);
    console.log(`👥 Found ${friends.length} friends to help.`);

    // 3. Connect to Contract
    const CloudDreamProtocol = await hre.ethers.getContractFactory("CloudDreamProtocol");
    const contract = CloudDreamProtocol.attach(contractAddress);

    // 4. Loop to Grant Karma
    for (let i = 0; i < friends.length; i++) {
        const friend = friends[i];
        console.log(`\n--- Resonance ${i + 1}/10 ---`);
        console.log(`friend: ${friend.address}`);

        try {
            // Check if already resonated
            const hasResonated = await contract.hasResonatedWith(friend.address, targetUser.address);
            if (hasResonated) {
                console.log(`⚠️  Already resonated. Skipping.`);
                continue;
            }

            // Execute Resonance
            // Friend calls respondToEcho(targetUser)
            const tx = await contract.connect(friend).respondToEcho(targetUser.address, `Karma Boost ${i + 1} 🚀`);
            process.stdout.write(`⏳ Transaction sent... `);
            await tx.wait();
            console.log(`✅ Confirmed!`);

        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
        }
    }

    // 5. Verify Result
    const finalKarma = await contract.karmaBalance(targetUser.address);
    console.log(`\n✨ Done! Final Karma for ${targetUser.address}: ${finalKarma.toString()}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
