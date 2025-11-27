# Commands for Setting Up the `zkphase` Project

This file contains the exact commands needed to set up your new `zkphase` project directory.

## Step 1: Copy Core Files

First, ensure you are in your `zkult` project directory:
```bash
cd /Users/valtoosh/zkult
```

Next, copy the entire single line below and paste it into your terminal to perform the copy.

```bash
rsync -av --exclude='.git' --exclude='node_modules' --exclude='keys' --exclude='target' --exclude='deployments' --exclude='artifacts' --exclude='cache' --exclude='*.zkey' --exclude='*.wasm' --exclude='*.r1cs' --exclude='*.sym' --exclude='*.ptau' . /Users/valtoosh/zkphase/
```

## Step 2: Verify the Copy

After the command finishes, verify that the files were copied successfully:

```bash
ls -F /Users/valtoosh/zkphase/
```

## Step 3: Start a New Gemini Session

If the files are there, you are ready to move on.

**Close this Gemini session and start a new one from *inside* the `/Users/valtoosh/zkphase` directory.**
