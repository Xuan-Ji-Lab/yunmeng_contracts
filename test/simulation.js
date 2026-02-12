const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("DreamSeeker Gas Simulation (Local)", function () {
    let seeker, core, treasury, drifter, vrfCoordinator, wishToken;
    let owner, user1;
    let vrfCoordinatorAddress;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        // Deploy Mocks
        const MockCore = await ethers.getContractFactory("MockCore");
        core = await MockCore.deploy();

        const MockTreasury = await ethers.getContractFactory("MockTreasury");
        treasury = await ethers.deployContract("MockTreasury");

        const MockDrifter = await ethers.getContractFactory("MockDrifter");
        drifter = await MockDrifter.deploy();

        const MockVRF = await ethers.getContractFactory("MockVRFCoordinator");
        vrfCoordinator = await MockVRF.deploy();
        vrfCoordinatorAddress = await vrfCoordinator.getAddress();

        const MockToken = await ethers.getContractFactory("MockToken");
        wishToken = await MockToken.deploy();

        // Deploy Seeker
        const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
        seeker = await upgrades.deployProxy(DreamSeeker, [
            await core.getAddress(),
            await treasury.getAddress(),
            await drifter.getAddress(),
            vrfCoordinatorAddress,
            await wishToken.getAddress()
        ], { initializer: "initialize" });

        // Set Config (SeekCost = 0.003 BNB)
        await seeker.setSeekConfig(
            ethers.parseEther("0.003"), // seekCost
            10, // karmaCost
            ethers.parseEther("0.001"), // pityBase
            9 // pityThreshold
        );
    });

    it("Should measure gas for Standard Wish (No Abyss)", async function () {
        // 1. Request
        const tx = await seeker.connect(user1).seekTruth("Test Wish", { value: ethers.parseEther("0.003") });
        const receipt = await tx.wait();
        // requestId is handled internally by mock

        // Need to find requestId. 
        // Parsing logs manually since we don't have easy access to request ID from mock
        // However, for rawFulfillRandomWords, we just need ANY requestId that matches s_requests.

        // But wait, s_requests stores requestId returned by VRF.
        // Our MockVRF returns a predictable ID?
        // Let's get the requestId from the event "SeekRequestSent"
        const event = receipt.logs
            .map(log => {
                try { return seeker.interface.parseLog(log); } catch (e) { return null; }
            })
            .find(parsed => parsed && parsed.name === "SeekRequestSent");

        expect(event).to.not.be.undefined;
        const requestId = event.args.requestId;

        console.log(`\nRequest ID: ${requestId}`);

        // 2. Fulfill (Standard - Tier 4)
        // randomWords = [999] (Tier 4)
        const randomWords = [999];

        // Perform Fulfill as Coordinator
        // We must impersonate Coordinator if it checks msg.sender
        // In local test, we have keys, but we need to sign as Coordinator address?
        // MockVRF is a contract. msg.sender will be the caller. 
        // DreamSeeker checks: if (msg.sender != address(vrfCoordinator))

        // So we must use impersonateAccount to call as MockVRF address?
        // OR, we can just use a signer that IS the coordinator?
        // But we deployed MockVRF as a contract.
        // We can use `hardhat_impersonateAccount` to call FROM the MockVRF address.

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [vrfCoordinatorAddress],
        });
        await network.provider.send("hardhat_setBalance", [
            vrfCoordinatorAddress,
            "0x1000000000000000000",
        ]);
        const coordSigner = await ethers.getSigner(vrfCoordinatorAddress);

        console.log("Simulating Callback (Standard)...");
        const fulfillTx = await seeker.connect(coordSigner).rawFulfillRandomWords(requestId, randomWords);
        const fulfillReceipt = await fulfillTx.wait();

        console.log(`Gas Used (Standard): ${fulfillReceipt.gasUsed.toString()}`);
    });

    it("Should measure gas for Abyss Trigger (Tier 0)", async function () {
        // 1. Request
        const tx = await seeker.connect(user1).seekTruth("Abyss Wish", { value: ethers.parseEther("0.003") });
        const receipt = await tx.wait();
        const event = receipt.logs
            .map(log => {
                try { return seeker.interface.parseLog(log); } catch (e) { return null; }
            })
            .find(parsed => parsed && parsed.name === "SeekRequestSent");
        const requestId = event.args.requestId;

        // 2. Fulfill (Abyss - Tier 0)
        // rng = randomWords[0] % 1000 = 0 -> randomWords[0] = 1000
        const randomWords = [1000];

        // Impersonate Coordinator
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [vrfCoordinatorAddress],
        });
        await network.provider.send("hardhat_setBalance", [
            vrfCoordinatorAddress,
            "0x1000000000000000000",
        ]);
        const coordSigner = await ethers.getSigner(vrfCoordinatorAddress);

        console.log("Simulating Callback (Abyss)...");
        const fulfillTx = await seeker.connect(coordSigner).rawFulfillRandomWords(requestId, randomWords);
        const fulfillReceipt = await fulfillTx.wait();

        console.log(`Gas Used (Abyss): ${fulfillReceipt.gasUsed.toString()}`);
    });
});
