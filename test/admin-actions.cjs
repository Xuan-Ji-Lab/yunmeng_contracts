const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load deployment info
const deploymentPath = path.join(__dirname, "../deploy/deployment-info.json");
const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

async function main() {
    const args = process.argv.slice(2);
    const action = args[0];

    if (!action) {
        console.log("Usage: node admin-actions.js <action> [args...]");
        console.log("Actions:");
        console.log("  create <topicId> <durationSeconds>");
        console.log("  settle <topicId> <outcomeIndex>");
        return;
    }

    // Connect to local node
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // Use the first account (deployer/admin)
    // NOTE: In Hardhat node, account 0 is usually the deployer.
    const signer = await provider.getSigner(0);
    console.log("Admin Address:", await signer.getAddress());

    const contract = new ethers.Contract(deploymentInfo.address, deploymentInfo.abi, signer);

    if (action === "create") {
        const topicIdStr = args[1];
        const duration = parseInt(args[2] || "3600");
        const title = args[3] || `${topicIdStr} Topic`;
        const optionA = args[4] || "Yes";
        const optionB = args[5] || "No";

        if (!topicIdStr) {
            console.error("Missing topicId");
            return;
        }

        const endTime = Math.floor(Date.now() / 1000) + duration;

        console.log(`Creating topic: ${topicIdStr}`);
        console.log(`Title: ${title}`);
        console.log(`Options: ${optionA} / ${optionB}`);
        console.log(`End Time: ${new Date(endTime * 1000).toISOString()}`);

        // Contract method: createTopic(string _topicIdStr, uint256 _duration, string _title, string _optionA, string _optionB)
        const tx = await contract.createTopic(topicIdStr, duration, title, optionA, optionB);
        console.log("Tx sent:", tx.hash);
        await tx.wait();
        console.log("Topic Created!");

    } else if (action === "settle") {
        const topicIdRaw = args[1];
        const outcome = parseInt(args[2]);

        if (!topicIdRaw || isNaN(outcome)) {
            console.error("Missing topicId or outcome");
            return;
        }

        const topicId = topicIdRaw.startsWith("0x") ? topicIdRaw : ethers.id(topicIdRaw);
        console.log(`Settling topic: ${topicIdRaw} (${topicId}) with outcome ${outcome}`);

        const tx = await contract.settleTopic(topicId, outcome);
        console.log("Tx sent:", tx.hash);
        await tx.wait();
        console.log("Topic Settled!");


    } else if (action === "bet") {
        const topicIdRaw = args[1];
        const option = parseInt(args[2]);
        const amount = args[3] || "0.01";

        if (!topicIdRaw || isNaN(option)) {
            console.error("Missing topicId or option");
            return;
        }

        const topicId = topicIdRaw.startsWith("0x") ? topicIdRaw : ethers.id(topicIdRaw);

        // Use a different signer (User)
        const user = await provider.getSigner(1);
        console.log(`Betting as User: ${await user.getAddress()}`);
        console.log(`Topic: ${topicIdRaw}, Option: ${option}, Amount: ${amount} ETH`);

        const contractUser = contract.connect(user);
        const tx = await contractUser.placeBet(topicId, option, { value: ethers.parseEther(amount) });
        console.log("Tx sent:", tx.hash);
        await tx.wait();
        console.log("Bet Placed!");

    } else {
        console.log("Unknown action");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
