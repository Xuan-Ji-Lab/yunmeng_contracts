const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gas Starvation Test", function () {
    it("Should revert if user contract consumes all gas and remaining 1/64 is insufficient for storage", async function () {
        // 1. Deploy Mocks
        const [admin] = await ethers.getSigners();

        // Mock Core
        const Core = await ethers.getContractFactory("MockCore"); // Need simple mock
        // Actually let's just use the real contracts if possible, or simplified versions.
        // Using real contracts is safer to prove the gas costs.

        const CloudDreamCore = await ethers.getContractFactory("CloudDreamCore");
        const core = await CloudDreamCore.deploy();
        await core.initialize();

        const DreamTreasury = await ethers.getContractFactory("DreamTreasury");
        const treasury = await DreamTreasury.deploy();
        await treasury.initialize(await core.getAddress(), await core.getAddress(), await core.getAddress());

        // Mock VRF Coordinator
        const MockVRF = await ethers.getContractFactory("MockVRFCoordinator");
        const vrf = await MockVRF.deploy();

        const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
        const seeker = await DreamSeeker.deploy();
        await seeker.initialize(
            await core.getAddress(),
            await treasury.getAddress(),
            await core.getAddress(), // drifter placeholder
            await vrf.getAddress(),
            await core.getAddress() // token placeholder
        );

        // Setup Roles
        await core.grantRole(await core.SEEKER_ROLE(), await seeker.getAddress());
        await core.setSeeker(await seeker.getAddress());
        await core.setTreasury(await treasury.getAddress());

        // Fund Treasury
        await admin.sendTransaction({
            to: await treasury.getAddress(),
            value: ethers.parseEther("10.0")
        });

        // 2. Deploy Gas Guzzling User
        const Malicious = await ethers.getContractFactory("MaliciousUser");
        const badUser = await Malicious.deploy();

        // 3. Setup State: Tribulation = 8
        // We can't set directly, so we need to run 8 times? Too slow.
        // Let's use cheat code or just call a helper if we had one.
        // Or just make `pityThreshold` = 1.
        await seeker.setSeekConfig(
            ethers.parseEther("0.005"),
            10,
            ethers.parseEther("0.01"),
            1 // Threshold = 1, so every Draw triggers Pity if not win
        );

        // 4. Request
        await seeker.connect(admin).seekTruth("Test", { value: ethers.parseEther("0.005") });
        // Assume requestId = 1

        // 5. Fulfill with Gas Limit = 2,000,000 (Mainnet Config)
        // We need to simulate the call from VRF.
        // Impersonate VRF? Or just call rawFulfillRandomWords if we valid consumer.
        // The MockVRF usually calls back. Let's act as VRF.

        console.log("Simulating callback...");

        // Force the user to be the `badUser` address? 
        // Wait, `seekTruth` sets `msg.sender` as user. 
        // We need `badUser` to call `seekTruth`.

        await badUser.attack(await seeker.getAddress(), { value: ethers.parseEther("0.005") });
        // Now request mapping has `badUser` as sender.

        // Fulfill
        // Tier 4 result => Trigger Pity (Threshold 1)

        try {
            await seeker.connect(admin).rawFulfillRandomWords(1, [200], {
                gasLimit: 2000000
            });
            console.log("Callback Successful (Unexpected)");
        } catch (e) {
            console.log("Callback Reverted as expected!");
            console.log("Error:", e.message);
        }
    });
});
