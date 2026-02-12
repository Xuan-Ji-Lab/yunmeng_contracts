const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Updating DreamSeeker Seek Cost...");

    // 1. Get Deployments
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("Deployment file not found!");
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const seekerAddress = info.contracts.DreamSeeker;

    if (!seekerAddress) {
        throw new Error("DreamSeeker address not found.");
    }

    // 2. Attach Seeker contract
    console.log(`DreamSeeker Address: ${seekerAddress}`);
    const DreamSeeker = await hre.ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress);

    // 3. Read Current Config
    const currentSeekCost = await seeker.seekCost();
    const currentKarmaCost = await seeker.karmaCost();
    const currentPityBase = await seeker.pityBase();
    const currentPityThreshold = await seeker.pityThreshold();

    console.log(`Current Config:`);
    console.log(`- seekCost: ${hre.ethers.formatEther(currentSeekCost)} BNB`);
    console.log(`- karmaCost: ${currentKarmaCost}`);
    console.log(`- pityBase: ${hre.ethers.formatEther(currentPityBase)} BNB`);
    console.log(`- pityThreshold: ${currentPityThreshold}`);

    const TARGET_SEEK_COST = hre.ethers.parseEther("0.003"); // 0.003 BNB

    if (currentSeekCost.toString() === TARGET_SEEK_COST.toString()) {
        console.log("Seek Cost is already 0.003 BNB. No action needed.");
        return;
    }

    // 4. Update Config
    console.log(`Setting Seek Cost to: 0.003 BNB...`);

    // function setSeekConfig(uint256 _seekCost, uint256 _karmaCost, uint256 _pityBase, uint256 _pityThreshold)
    const tx = await seeker.setSeekConfig(
        TARGET_SEEK_COST,
        currentKarmaCost,
        currentPityBase,
        currentPityThreshold
    );
    console.log(`Tx sent: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Seek Config Updated Successfully!");

    // 5. Verify
    const newSeekCost = await seeker.seekCost();
    console.log(`New Seek Cost: ${hre.ethers.formatEther(newSeekCost)} BNB`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
