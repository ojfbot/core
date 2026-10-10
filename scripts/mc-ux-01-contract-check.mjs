#!/usr/bin/env node
import { main } from './lib/mc-ux-01-contract.mjs';

process.exitCode = main(process.argv.slice(2));
