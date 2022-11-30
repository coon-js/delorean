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
import l8 from "@l8js/l8";
import path from "path";
import {fileURLToPath} from "url";
import commandLineArgs from "command-line-args";
import chalk from "chalk";
import getUsage from "command-line-usage";
import shell from "shelljs";
import jsonbeautify from "json-beautify";
import randomInteger from "random-int";



const
    deloreanDir = fileURLToPath(new URL("../", import.meta.url)),
    babelBin = "babel",
    deloreanPackage = fs.readJsonSync(`${deloreanDir}/package.json`),
    log = console.log;

const header = `
     |      |                  ${deloreanPackage.version}                         
  _\` |  _ \\ |  _ \\   __| _ \\  _\` | __ \\  
 (   |  __/ | (   | |    __/ (   | |   | 
\\__,_|\\___|_|\\___/ _|  \\___|\\__,_|_|  _|
`;

const sections = [
    {
        header: chalk.blue(header),
        content: [
            chalk.bgCyan("Back to the future with transpiling Ext JS!"),
            chalk.yellow("@coon-js/delorean") + " " + chalk.blue("https://github.com/coon-js/delorean")
        ].join("\n")
    },
    {
        header: "Synopsis",
        content: [
            "$ npx delorean {bold --prepare}",
            "$ npx delorean {bold --revert}",
            "$ npx delorean {bold --help}"
        ]
    },
    {
        header: "Options",
        optionList: [{
            name: "prepare",
            alias: "p",
            description: "moves the source files specified with {underline map} in the {underline .deloranrc.json} to the {underline .deloreanbuild}-folder, and updates the package/app file with updated paths to source directories. {bold babel} will then transpile the sources found in {underline .deloreanbuild}. Run your {bold build} command afterwards.",
            type: Boolean
        }, {
            name: "revert",
            alias: "r",
            description: "reverts the changes made by {bold prepare} to the package/app configuration file",
            type: Boolean
        }, {
            name: "config",
            alias: "c",
            description: "config file to use (defaults to ../.deloreanrc.json)",
            type: Boolean
        }, {
            name: "help",
            alias: "h",
            description: "show this screen",
            type: Boolean
        }]
    }
];

let options, CONFIG_FILE = "./.deloreanrc.json", showHelp = true, IS_PREPARE = false, IS_CLEANUP = false;


const optionDefinitions = [
    { name: "prepare", alias: "p"},
    { name: "revert", alias: "r"},
    { name: "config", alias: "c"},
    { name: "help", alias: "h"},
    { name: "base", alias: "b", type: String}
];

try {
    options = commandLineArgs(optionDefinitions);
    if (options.help !== undefined) {
        showHelp = true;
    }
    if (options.config) {
        CONFIG_FILE = options.config;
    }
    if (options.prepare !== undefined || options.revert !== undefined) {
        IS_PREPARE = options.prepare !== undefined;
        IS_CLEANUP = !IS_PREPARE;
        showHelp = false;
    }
} catch (e) {
    // intentionally left empty
}


if (showHelp) {
    console.log(getUsage(sections));
    process.exit();
}


const
    base = options.base ? new URL(`file://${options.base}`) : new URL("../../../../", import.meta.url),
    projectDir = fileURLToPath(base),
    babelConfig = `${projectDir}/.babelrc`,
    pkg = fs.readJsonSync(`${projectDir}/package.json`),
    projectConfigLookup = fs.pathExistsSync(`${projectDir}/app.json`) ? `${projectDir}/app.json` : `${projectDir}/package.json`;

if (!fs.pathExistsSync(projectConfigLookup)) {
    log(chalk.red("Cannot find project config (app.json/package.json), exiting..."));
    process.exit(1);
}

const projectConfigFile = path.resolve(projectConfigLookup);

const quote = () => {

    const quotes = fs.readJsonSync(fileURLToPath( new URL("../lib/quotes.json", import.meta.url)));

    return quotes[randomInteger(0, quotes.length-1)];

}

const readConfiguration = () => {

    const p = path.resolve(`${projectDir}/${CONFIG_FILE}`);

    if (!fs.pathExistsSync(p)) {
        log(chalk.red(`(trying "${p}"...`));
        log(chalk.red(`no configuration "${CONFIG_FILE}" found, exiting...`));
        process.exit(1);
    }

    return fs.readJsonSync(p);
}

/**
 * Considers entries of the following form:
 *  ${package.dir}/src
 *  ${package.dir}/${toolkit.name}/src
 *  app/shared/src"
 *  app/${build.id}/src
 *  app/shared/overrides
 *  app/${build.id}/overrides
 */
const getSourcePaths = () => {

    const deloreanConfig = readConfiguration();
    const projectConfig =  fs.readJsonSync(projectConfigFile);
    const paths = deloreanConfig.map;
    const toolkitNames = deloreanConfig.toolkits || [];
    const buildIds = deloreanConfig.builds || [];

    let output = [];

    paths.map(path => {

        let value = l8.unchain(path, projectConfig);

        if (!value) {
            return;
        }

        const spreadTpl = (dir, tpl, replacements) => {
            let result = [];
            if (dir.indexOf(tpl) !== -1) {

                 replacements.forEach(rpl => {
                    result.push(dir.replace(tpl, rpl));
                });
            } else {
                result.push(dir);
            }
            return result;
        };

        const visitEntries = (entries => {
            entries = entries.map(entry => {
                return spreadTpl(entry, "${toolkit.name}", toolkitNames);
            }).flat();

            entries = entries.map(entry => {
                return spreadTpl(entry, "${build.id}", buildIds);
            }).flat();

            return entries.flat().filter((el, index) => {
                return entries.indexOf(el) === index;
            });
        });
        output = output.concat(visitEntries(value));
    });

    output = output.map(dir => {
        dir = dir.replace(".deloreanbuild", "");
        if (dir.indexOf("${package.dir}") !== -1) {
            dir = dir.replace("${package.dir}", ".");
        }
        l8.unify(dir, "/");
        return dir;
    });

    return output;

};

/**
 * Process "externals"
 * @returns {*[]}
 */
const processExternals = (revert) => {

    const deloreanConfig = readConfiguration();
    const externals = deloreanConfig.externals || [];


    externals.forEach(external => {

        const cfgExternal = external;

        external = path.resolve(`${projectDir}/${external}`);

        if (!fs.pathExistsSync(`${external}/.deloreanrc.json`)) {
            log(chalk.red(`${cfgExternal} has no .deloreanrc.json configured, skipping`));
        } else {

            let cmd;

            if (revert === true) {
                log(chalk.green(`${cfgExternal} has .deloreanrc.json, reverting...`));
                log(chalk.yellow(quote()));
                cmd = `npx --prefix ${cfgExternal} delorean -r`;
            } else {
                log(chalk.green(`${cfgExternal} has .deloreanrc.json, preparing...`));
                log(chalk.yellow(quote()));
                cmd = `npx --prefix ${cfgExternal} delorean -p`;
            }


            shell.exec(cmd);
        }
    })
};



/**
 * Updates project config (app.json/package.json) with .deloreanbuild folder information.
 * Removes this information if revert=true
 *
 * @param {Boolean} revert
 */
const changeProjectConfig = (revert = false) => {

    const deloreanConfig = readConfiguration();
    let projectConfig =  fs.readJsonSync(projectConfigFile);

    const backupFile = path.resolve(`${projectConfigFile}.delorean`);

    // create backup
    if (revert !== true) {
        log(chalk.yellow(`Creating project file backup at ${backupFile}`));
        fs.copySync(projectConfigFile, backupFile);
    }

    const paths = deloreanConfig.map;

    paths.map(path => {

        let value = l8.unchain(path, projectConfig);

        if (!value) {
            return;
        }

        value = value.map(dir => {

            dir = dir.replace(".deloreanbuild", "");

            if (revert !== true) {
                if (dir.indexOf("${package.dir}") !== -1) {
                    dir = dir.replace("${package.dir}", "${package.dir}/" + ".deloreanbuild/");
                } else {
                    dir = `.deloreanbuild/${dir}`;
                }
            }

            return l8.unify(dir, "/");
        });

        projectConfig = l8.chain(path, projectConfig, value, true);
    });


    log(chalk.blue(`Updating ${projectConfigFile} with source directories...`));

    fs.outputFileSync(projectConfigFile, jsonbeautify(projectConfig, null, 4));
};


/**
 * Copies default templates from @coon-js/delorean if not already available.
 *
 */
const copyConfigurationTemplates = () => {

    const source = [
        [`${deloreanDir}/.babelrc.tpl`, ".babelrc"],
        [`${deloreanDir}/.deloreanrc.json.tpl`, ".deloreanrc.json"]
    ];

    source.map(fileInfo => {

        const origin = path.resolve(fileInfo[0]);
        const target = path.resolve(`${projectDir}/${fileInfo[1]}`);

        log(chalk.blue(`Checking if configuration file ${fileInfo[1]} exists...`));
        if (!fs.pathExistsSync(target)) {
            log(chalk.green(`Creating ${target}`));
            fs.copySync(origin, target);
        } else {
            log(chalk.blue(`${target} exists, skipping.`));
        }
    });

};

/**
 * Moves source paths to .deloreanbuild folder
 */
const moveProjectFiles = function () {
    const output = getSourcePaths();
    const targetBase = `${projectDir}/.deloreanbuild`;

    output.forEach(dir => {

        const origin = path.resolve(`${projectDir}/${dir}`);
        const target = path.resolve(`${targetBase}/${dir}`);

        // clean up existing dirs
        if (fs.pathExistsSync(target)) {
            log(chalk.yellow(`...removing artefacts: ${target}`));
            fs.removeSync(`${target}`);
        }

        // check if origin exists, then copy
        if (fs.pathExistsSync(origin)) {
            log(chalk.yellow(`...copying source: ${origin}`));
            fs.removeSync(`${target}`);
            fs.copySync(`${origin}`, `${target}`);
        }
    });
};


const PREPARE = () => {
    copyConfigurationTemplates();
    moveProjectFiles();
    changeProjectConfig();
    processExternals();


    const babelTarget = path.resolve(`${projectDir}/.deloreanbuild/`);

    log(chalk.green("The Babel fish is small, yellow and leech-like..."));
    log(chalk.yellow("             ><_> "));


    log(chalk.blue(`Processing ${babelTarget}`));
    log(chalk.blue(`npx ${babelBin} ${babelTarget} -d ${babelTarget} --config-file ${babelConfig}`));

    //shell.exec(`node ${babelBin} ${babelTarget} -d ${babelTarget} --config-file ${babelConfig}`);
    shell.exec(`npx ${babelBin} ${babelTarget} -d ${babelTarget} --config-file ${babelConfig}`);
};


const CLEANUP = () => {
    changeProjectConfig(true);
    processExternals(true);

    log(chalk.green("If you stick a Babel fish in your ear you can instantly understand anything..."));
    log(chalk.yellow("            <_>< "));
};


if (IS_PREPARE) {
    PREPARE();
} else if (IS_CLEANUP) {
    CLEANUP();
}


process.exit();
