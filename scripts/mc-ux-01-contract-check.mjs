#!/usr/bin/env node
import process from 'node:process';

import { main } from './lib/mc-ux-01-contract.mjs';

process.exitCode = main(process.argv.slice(2));
