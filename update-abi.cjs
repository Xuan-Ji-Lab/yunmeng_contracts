const fs = require('fs');
const path = require('path');

const deploymentPath = '/Users/admin/Desktop/开发/抽签/ethereal-realm/src/deployment-modular.json';
const artifactPath = '/Users/admin/Desktop/开发/抽签/ethereal-contracts/artifacts/contracts/DreamSeeker.sol/DreamSeeker.json';

// Read Deployment JSON
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

// Read Artifact JSON
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

// Update ABI
if (!deployment.abis) {
    deployment.abis = {};
}
deployment.abis.DreamSeeker = artifact.abi;

// Write back
fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

console.log('Successfully updated DreamSeeker ABI in deployment-modular.json');
