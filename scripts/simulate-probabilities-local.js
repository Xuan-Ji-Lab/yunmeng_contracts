const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🎲 Starting Hardhat Local Probability Simulation (1000 Runs)...");

    const [deployer, user1] = await ethers.getSigners();

    // 1. Deploy Mock VRF
    console.log("Deploying MockVRF...");
    const MockVRF = await ethers.getContractFactory("MockVRFCoordinator");
    // MockVRF usually has no args in constructor
    const mockVrf = await MockVRF.deploy();
    await mockVrf.waitForDeployment();
    const mockVrfAddr = await mockVrf.getAddress();

    // 2. Deploy Dependencies

    // Deploy Token (Constructor args: 0)
    console.log("Deploying Token...");
    const Token = await ethers.getContractFactory("WishPowerToken");
    const token = await Token.deploy();
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();

    // Deploy Core (Initialize args: [admin])
    console.log("Deploying Core...");
    const Core = await ethers.getContractFactory("CloudDreamCore");
    const core = await upgrades.deployProxy(Core, [deployer.address], { initializer: 'initialize' });
    await core.waitForDeployment();
    const coreAddr = await core.getAddress();

    // Deploy Treasury (Initialize args: [core, flapPortal, wishToken])
    console.log("Deploying Treasury...");
    const Treasury = await ethers.getContractFactory("DreamTreasury");
    // Use mockVrfAddr as dummy flapPortal
    const treasury = await upgrades.deployProxy(Treasury, [coreAddr, mockVrfAddr, tokenAddr], { initializer: 'initialize' });
    await treasury.waitForDeployment();
    const treasuryAddr = await treasury.getAddress();

    // Deploy Drifter (Initialize args: [core])
    console.log("Deploying Drifter...");
    const Drifter = await ethers.getContractFactory("DreamDrifter");
    const drifter = await upgrades.deployProxy(Drifter, [coreAddr], { initializer: 'initialize' });
    await drifter.waitForDeployment();
    const drifterAddr = await drifter.getAddress();

    // Deploy Oracle (Initialize args: [core, treasury])
    console.log("Deploying Oracle...");
    const Oracle = await ethers.getContractFactory("DreamOracle");
    const oracle = await upgrades.deployProxy(Oracle, [coreAddr, treasuryAddr], { initializer: 'initialize' });
    await oracle.waitForDeployment();

    // Deploy Seeker (Initialize args: [core, treasury, drifter, vrfCoordinator, wishToken])
    console.log("Deploying Seeker...");
    const Seeker = await ethers.getContractFactory("DreamSeeker");
    const seeker = await upgrades.deployProxy(Seeker, [
        coreAddr,
        treasuryAddr,
        drifterAddr,
        mockVrfAddr,
        tokenAddr
    ], { initializer: 'initialize' });
    await seeker.waitForDeployment();
    const seekerAddr = await seeker.getAddress();

    // 3. Configure Roles
    // Core: grant ROLE to Seeker/Treasury if needed
    // Seeker needs OPERATOR_ROLE in core if it does specific things? No, usually core holds roles.
    // Core needs to know addresses
    await core.setContractAddresses(treasuryAddr, seekerAddr, drifterAddr, await oracle.getAddress());

    // Treasury: grant access to Seeker/Drifter/Oracle? It uses modifiers checking core.seeker(), etc.
    // Since we set addresses in core, Treasury modifiers should work (it calls core.seeker()).

    // Token: grant MINTER_ROLE to Treasury?
    // Token is Ownable or AccessControl?
    // WishPowerToken is Ownable. And has setProtocolContract.
    await token.setProtocolContract(treasuryAddr); // Or Seeker? ProtocolContract can mint.
    // Usually Treasury mints? Or Seeker?
    // Seeker calls Treasury.payoutToken -> Treasury transfers. Treasury must hold tokens.
    // So we need to mint tokens to Treasury or give it minting rights.
    // Token.sol: protocolContract can mint.
    // Let's set it to Treasury if Treasury mints, or Seeker.
    // But usually Treasury just holds funds.
    // For this test, Seeker might try to reward users.
    // If user hits Tier 4 (Common) -> Token Reward. Seeker calls Treasury.payoutToken.
    // Treasury checks balance.
    // So Treasury needs WISH balance.
    // Token: Deployer has initial supply. Transfer to Treasury.
    await token.transfer(treasuryAddr, ethers.parseEther("1000000"));

    // Seeker needs funds? No, users pay BNB.
    // Seeker payoutBNB -> call Treasury.payoutBNB.
    // Treasury needs BNB.
    // Fund Treasury with BNB.
    await deployer.sendTransaction({ to: treasuryAddr, value: ethers.parseEther("100") });

    // Set VRF Config in Seeker
    // Seeker handles VRF config via `core` config role?
    // Wait, Seeker code has `initialize` storing `vrfCoordinator`.
    // But `Core` has `setVRFConfig`.
    // Seeker uses `core.vrfKeyHash()` etc?
    // Let's look at Seeker logic for VRF request.
    // It creates request with `vrfCoordinator.requestRandomWords`.
    // Params come from `core`?
    // Seeker.sol (lines 172-176 in view_file 717) initializes defaults in storage?
    // Yes: check view_file 722. `initialize` sets `vrfCoordinator = _vrfCoordinator`.
    // And `seekCost = 0.005 ether`.

    // So we just need to ensure `approve` link if needed? V2 subscription?
    // Mock Coordinator doesn't need subscription funding usually unless codified.

    // Set 0 Cost for simulation
    await seeker.setSeekConfig(0, 10, ethers.parseEther("0.001"), 9);

    console.log("✅ Setup Complete. Running 1000 Simulations...");

    // 4. Run Simulation
    const RUNS = 10000;
    const results = { tier0: 0, tier1: 0, tier2: 0, tier3: 0, tier4: 0 };

    for (let i = 0; i < RUNS; i++) {
        if (i % 50 === 0) process.stdout.write(`\nRun ${i}: `);

        // 1. Request
        const tx = await seeker.seekTruth("Simulated Wish", { value: 0 });
        const rc = await tx.wait();

        // Find Request ID
        const reqEvent = rc.logs.find(x => x.fragment && x.fragment.name === 'SeekRequestSent');
        const reqId = reqEvent.args[0];

        // 2. Fulfill
        const randomNum = ethers.toBigInt(ethers.randomBytes(32));
        const fulfillTx = await mockVrf.fulfillRandomWordsWithType(reqId, [randomNum]);
        const fulfillRc = await fulfillTx.wait();

        // 3. Catch Result
        let resultEvent;
        for (const log of fulfillRc.logs) {
            if (log.address.toLowerCase() === seekerAddr.toLowerCase()) {
                try {
                    const parsed = Seeker.interface.parseLog(log);
                    if (parsed && parsed.name === 'SeekResult') {
                        resultEvent = parsed;
                        break;
                    }
                } catch (e) { }
            }
        }

        if (resultEvent) {
            const tier = Number(resultEvent.args[1]);
            if (tier === 0) results.tier0++;
            else if (tier === 1) results.tier1++;
            else if (tier === 2) results.tier2++;
            else if (tier === 3) results.tier3++;
            else results.tier4++;
            process.stdout.write(".");
        } else {
            process.stdout.write("x");
        }
    }

    // 5. Report
    console.log("\n\n--- 📊 Local Simulation Report (1000 Runs) ---");
    console.log(`Total Runs: ${RUNS}`);
    console.log(`Tier 0 (Guixu - 0.1%):   ${results.tier0} (${(results.tier0 / RUNS * 100).toFixed(1)}%)`);
    console.log(`Tier 1 (Divine - 1.0%):  ${results.tier1} (${(results.tier1 / RUNS * 100).toFixed(1)}%)`);
    console.log(`Tier 2 (Ether - 3.0%):   ${results.tier2} (${(results.tier2 / RUNS * 100).toFixed(1)}%)`);
    console.log(`Tier 3 (Rare - 10.0%):   ${results.tier3} (${(results.tier3 / RUNS * 100).toFixed(1)}%)`);
    console.log(`Tier 4 (Common - 85.9%): ${results.tier4} (${(results.tier4 / RUNS * 100).toFixed(1)}%)`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
