const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🌊 Testing Guixu (Abyss) Mechanics via Backdoor...");

    // 1. Load Deployment
    const deploymentPath = path.join(__dirname, "../../ethereal-realm/src/deployment-modular.json");
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;

    // 2. Get Contracts
    const Seeker = await ethers.getContractAt("DreamSeeker", contracts.DreamSeeker);
    // Connect to Treasury to check balance
    const Treasury = await ethers.getContractAt("DreamTreasury", contracts.DreamTreasury);
    const Token = await ethers.getContractAt("WishPowerToken", contracts.WishPowerToken);

    // 3. Get Signers
    // On Testnet, getSigners() only returns accounts from config.
    const [deployer] = await ethers.getSigners();

    // Create random users for testing
    const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
    const user2 = ethers.Wallet.createRandom().connect(ethers.provider);

    console.log(`Tester (Deployer): ${deployer.address}`);
    console.log(`User1 (New): ${user1.address}`);
    console.log(`User2 (New): ${user2.address}`);

    // Fund new users
    const fundingAmount = ethers.parseEther("0.005"); // Enough for gas
    console.log(`Funding User1 & User2 with ${ethers.formatEther(fundingAmount)} BNB...`);

    const txFund1 = await deployer.sendTransaction({ to: user1.address, value: fundingAmount });
    await txFund1.wait();
    const txFund2 = await deployer.sendTransaction({ to: user2.address, value: fundingAmount });
    await txFund2.wait();
    console.log("✅ Users Funded.");

    // Ensure Tester Role (default deployer has it)
    // Check Treasury Balance first
    let balance = await ethers.provider.getBalance(contracts.DreamTreasury);
    console.log(`Treasury BNB Balance: ${ethers.formatEther(balance)} BNB`);

    if (balance < ethers.parseEther("0.1")) {
        console.log("⚠️ Treasury low on BNB. Funding...");
        await deployer.sendTransaction({
            to: contracts.DreamTreasury,
            value: ethers.parseEther("0.1")
        });
        console.log("✅ Treasury Funded.");
    }

    // --- Scenario 1: First Abyss Walker (User1) ---
    console.log("\n--- 1. Testing First Abyss Trigger (User1) ---");

    const balanceBefore = await ethers.provider.getBalance(user1.address);
    console.log(`User1 Start Balance: ${ethers.formatEther(balanceBefore)} BNB`);

    console.log("Adding User1 & User2 to Testers whitelist...");
    // Seeker.setTester requires CONFIG_ROLE (Deployer should have it)
    const txRole1 = await Seeker.connect(deployer).setTester(user1.address, true);
    await txRole1.wait();

    // Also User2
    const txRole2 = await Seeker.connect(deployer).setTester(user2.address, true);
    await txRole2.wait();
    console.log("✅ Testers Whitelisted.");

    // Action: User1 Forces Abyss
    console.log("User1 calling testForceAbyss...");
    const tx1 = await Seeker.connect(user1).testForceAbyss("User1 Force Abyss");
    const rc1 = await tx1.wait();

    // Analyze Logs
    // AbyssTriggered(address indexed user, bool isGrandFinale, uint256 tribulationCount)
    const abyssEvent = rc1.logs.find(x => x.fragment && x.fragment.name === 'AbyssTriggered');
    if (abyssEvent) {
        console.log(`🎉 Abyss Triggered! (Grand Finale: ${abyssEvent.args[1]})`);
    } else {
        console.error("❌ AbyssTriggered event not found!");
    }

    // SeekResult(address indexed user, uint8 tier, uint256 reward, string wishText)
    const seekEvent = rc1.logs.find(x => x.fragment && x.fragment.name === 'SeekResult');
    if (seekEvent) {
        console.log(`Seek Result: Tier ${seekEvent.args[1]}`);
        console.log(`Winner Reward: ${ethers.formatEther(seekEvent.args[2])} WISH`);
    }

    const balanceAfter = await ethers.provider.getBalance(user1.address);
    console.log(`User1 End Balance: ${ethers.formatEther(balanceAfter)} BNB`);
    console.log(`Diff: +${ethers.formatEther(balanceAfter - balanceBefore)} BNB (includes gas cost deduction)`);

    // --- Scenario 2: Second Abyss Walker (User2) - Checking Dividends ---
    console.log("\n--- 2. Testing Second Abyss Trigger (User2) & Dividends ---");

    // Increase Treasury again to have a pot
    // await deployer.sendTransaction({ to: contracts.DreamTreasury, value: ethers.parseEther("0.001") });

    // User2 Forces Abyss
    console.log("User2 calling testForceAbyss...");
    const tx2 = await Seeker.connect(user2).testForceAbyss("User2 Force Abyss");
    const rc2 = await tx2.wait();

    const abyssEvent2 = rc2.logs.find(x => x.fragment && x.fragment.name === 'AbyssTriggered');
    if (abyssEvent2) {
        console.log(`🎉 Abyss #2 Triggered!`);
    }

    const seekEvent2 = rc2.logs.find(x => x.fragment && x.fragment.name === 'SeekResult');
    if (seekEvent2) {
        console.log(`Winner Reward: ${ethers.formatEther(seekEvent2.args[2])} WISH`);
    }

    // Check User1's Claimable Dividend
    const claimable = await Seeker.getUnclaimedDividend(user1.address);
    console.log(`User1 Claimable Dividend: ${ethers.formatEther(claimable)} WISH`);

    if (claimable > 0n) {
        console.log(`✅ Dividend Accrual Verified.`);
    } else {
        console.error(`❌ User1 should have dividends but has 0.`);
    }

    // Cleanup: Revoke roles (optional, but good practice)
    console.log("\n--- Cleanup ---");
    await Seeker.connect(deployer).setTester(user1.address, false);
    await Seeker.connect(deployer).setTester(user2.address, false);
    console.log("Testers removed.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
