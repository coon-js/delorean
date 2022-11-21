#!/usr/bin/env node

/**
 * coon.js
 * delorean
 * Copyright (C) 2022 Thorsten Suckow-Homberg https://github.com/coon-js/delorean
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


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

