const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const deployInfo = JSON.parse(fs.readFileSync("deploy/deployment-modular.json"));
    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);

    // 1. Check Upkeep again
    console.log("Checking Upkeep status...");
    const [upkeepNeeded, performData] = await treasury.checkUpkeep("0x");
    console.log("Upkeep Needed:", upkeepNeeded);

    if (!upkeepNeeded) {
        console.log("❌ Upkeep not needed. (Did it trigger already?)");
        const pending = await treasury.pendingTaxBuyback();
        console.log("Pending:", hre.ethers.formatEther(pending));
        return;
    }

    // 2. Simulate Perform Upkeep
    console.log("Simulating performUpkeep...");
    // We need to impersonate the Forwarder because checkUpkeep works (view), but performUpkeep might check msg.sender if restricted?
    // Wait, executePendingTaxBuyback checks: msg.sender == seeker || hasRole(OPERATOR) || _isAutomationForwarder()
    // performUpkeep -> executePendingTaxBuyback.
    // performUpkeep is external. msg.sender will be the caller.
    // **Our performUpkeep implementation does NOT check msg.sender.**
    // public function executePendingTaxBuyback() DOES check.
    // performUpkeep calls executePendingTaxBuyback.
    // So if performUpkeep is called ONLY by the forwarder (via `AutomationCompatibleInterface`?), wait.

    // Let's look at the contract code again.
    // function performUpkeep(bytes calldata) external override { executePendingTaxBuyback(); }
    // function executePendingTaxBuyback() public { require(..., "Treasury: unauthorized"); }

    // `performUpkeep` becomes `msg.sender` for `executePendingTaxBuyback`? NO.
    // `performUpkeep` is called by Chainlink `Forwarder`.
    // Inside `performUpkeep`, `this` is the contract. 
    // `executePendingTaxBuyback` is called internally? No, it's `address(this).call`? No, it's a direct function call.
    // `executePendingTaxBuyback` uses `msg.sender`.
    // In Solidity, an internal call to a public function PRESERVES `msg.sender`.
    // So if Chainlink Forwarder calls `performUpkeep`, `msg.sender` is the Forwarder.
    // `executePendingTaxBuyback` checks `msg.sender`.
    // `_isAutomationForwarder()` checks `msg.sender == automationForwarder`.

    // So simulation must be done impersonating the Forwarder.

    const forwarderAddr = await treasury.automationForwarder();
    console.log("Impersonating Forwarder:", forwarderAddr);

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [forwarderAddr],
    });

    // Fund the forwarder to pay for gas
    const [funder] = await hre.ethers.getSigners();
    await funder.sendTransaction({
        to: forwarderAddr,
        value: hre.ethers.parseEther("1.0")
    });

    const forwarderSigner = await hre.ethers.getSigner(forwarderAddr);

    try {
        const tx = await treasury.connect(forwarderSigner).performUpkeep(performData, { gasLimit: 500000 });
        console.log("Tx sent. Waiting for receipt...");
        const receipt = await tx.wait();
        console.log("✅ Perform Upkeep Successful!");
        console.log("Gas Used:", receipt.gasUsed.toString());
    } catch (e) {
        console.error("❌ Perform Upkeep Failed!");
        console.error(e);

        // Try to decode error
        if (e.data) {
            console.log("Error Data:", e.data);
        }
    }
}

main().catch(console.error);
