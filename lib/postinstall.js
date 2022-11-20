#!/usr/bin/env node

import fs from "fs-extra";
import {fileURLToPath} from "url";
import prompts from "prompts";
const projectDir = process.env.INIT_CWD;

console.log("Checking if .babelrc exists...");

const copy = () => {
    fs.copySync(
        fileURLToPath(new URL("../.babelrc.tpl", import.meta.url)),
        `${projectDir}/.babelrc`
    );
    console.log("...done.");

};

if (fs.pathExistsSync(`${projectDir}/.babelrc`)) {

    (async () => {
        const overwrite = await prompts({
            type: "confirm",
            name: "yes",
            message: "Found .babelrc in the project directory. Okay to overwrite?",
            initial: false
        });

        if (overwrite.yes) {
            console.log("Removing old .babelrc and copying new...");
            fs.removeSync(`${projectDir}/.babelrc`);
            copy();
        } else {
            console.log("Nothing to see here, move along.");
        }

        console.log("Bye.");
        process.exit(0);

    })();

} else {
    console.log(".babelrc not found. Coyping default.");
    copy();
    process.exit(0);
}

