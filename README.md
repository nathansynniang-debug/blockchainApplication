# ChargeBid: EV charging reverse auction

```
hardhat/   Solidity (Escrow.sol, EVCToken.sol), tests, deploy script   (Hardhat 3 + ethers)
backend/   Express API: users, roles, stations, vehicles, sessions     (JSON file store)
frontend/  Next.js app: home -> sign-in popup -> dashboard / admin     (ethers v6)
```

## Run it (3 terminals)

**1. Local chain + contracts**
```bash
cd hardhat && npm install
npx hardhat node                 # terminal 1: keep running, prints 20 funded accounts
npm run deploy:local             # terminal 2: deploys, registers accounts #1-#5 as stations,
                                 # writes frontend/src/contracts/deployment.json
npm test                         # optional: Solidity + TypeScript tests
```

**2. Backend**
```bash
cd backend && npm install
cp .env.example .env             # set JWT_SECRET and ADMIN_PASSWORD
npm run dev                      # http://localhost:4000
```

**3. Frontend**
```bash
cd frontend && npm install
cp .env.local.example .env.local
npm run dev                      # http://localhost:3000
```

## Using it
1. In MetaMask, import a private key printed by `npx hardhat node`. The app adds the "Hardhat Local" network (chain 31337) for you.
2. Home page -> **Sign in** -> popup -> **Connect wallet** -> sign the message -> you land on the dashboard.
3. Click **Get 1,000 EVC** (faucet), register an EV, choose kWh, then **Start reverse auction**.
   Your wallet calls `reverseAuction(stations, rates, kWh)`; the cheapest station wins; click **Pay** to approve + `payAuction`, and the Escrow forwards the EVC to that station's wallet.
4. Admin: sign in with the username/password from `backend/.env` (default `admin` / `admin123`), or with a wallet listed in `ADMIN_WALLETS` (Hardhat account #0 by default). Open **Stations admin** to add/edit stations.
   New stations must be registered on-chain from the owner wallet (account #0) via **Register on-chain**.

## Contract flow
`reverseAuction` -> picks lowest rate, stores an Open auction, emits `AuctionWon`
`payAuction(id)` -> `transferFrom(user -> escrow)`, then `transfer(escrow -> station)`, emits `AuctionPaid`

Notes
- The final hop uses `transfer` from the escrow, not `transferFrom(address(this), ...)`: a contract can't spend its own balance through `transferFrom` without approving itself.
- Rates are supplied by the caller (as you specified), so the on-chain check is that each station is registered. For production, store each station's rate on-chain so a driver can't submit a lower rate than the station actually charges.
- Backend auth: bcrypt passwords, JWT, wallet login via signed one-time nonce (`verifyMessage`). The JSON datastore is for development only.
