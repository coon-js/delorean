#!/usr/bin/env node

import fs from "fs-extra";
import l8 from "@l8js/l8";
import path from "path";
import {fileURLToPath} from "url";
import commandLineArgs from "command-line-args";
import chalk from "chalk";
import getUsage from "command-line-usage";
import shell from "shelljs";
import jsonbeautify from "json-beautify";


const
    deloreanDir = fileURLToPath(new URL("../", import.meta.url)),
    babelBin = "babel",
    log = console.log;

const header = `
     |      |                            
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
            description: `Moves the source files specified with {underline map} in the {underline .deloranrc.json} to
                the {underline .deloreanbuild}-folder, and updates the package/app file with updated paths to source 
                directories. {bold babel} will then transpile the sources found in {underline .deloreanbuild}. 
                Run your {bold build} command afterwards.`,
            type: Boolean
        }, {
            name: "revert",
            alias: "r",
            description: "Reverts the changes made by {bold prepare} to the package/app configuration file",
            type: Boolean
        }, {
            name: "help",
            alias: "h",
            description: "show this screen",
            type: Boolean
        }]
    }
];

let options, showHelp = true, IS_PREPARE = false, IS_CLEANUP = false;


const optionDefinitions = [
    { name: "prepare", alias: "p"},
    { name: "revert", alias: "r"},
    { name: "help", alias: "h"},
    { name: "base", alias: "b", type: String}
];

try {
    options = commandLineArgs(optionDefinitions);
    if (options.help !== undefined) {
        showHelp = true;
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

    const deloreanConfig = fs.readJsonSync(`${projectDir}/.deloreanrc.json`);
    const projectConfig =  fs.readJsonSync(projectConfigFile);
    const paths = deloreanConfig.map;
    const toolkitNames = deloreanConfig.toolkits;
    const buildIds = deloreanConfig.builds;

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
 * Updates project config (app.json/package.json) with .deloreanbuild folder information.
 * Removes this information if revert=true
 *
 * @param {Boolean} revert
 */
const changeProjectConfig = (revert = false) => {

    const deloreanConfig = fs.readJsonSync(`${projectDir}/.deloreanrc.json`);
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

    const babelTarget = path.resolve(`${projectDir}/.deloreanbuild/`);

    log(chalk.green(`The Babel fish is small, yellow and leech-like...`));
    log(chalk.yellow(`             ><_> `));


    log(chalk.blue(`Processing ${babelTarget}`));
    log(chalk.blue(`npx ${babelBin} ${babelTarget} -d ${babelTarget} --config-file ${babelConfig}`));

    //shell.exec(`node ${babelBin} ${babelTarget} -d ${babelTarget} --config-file ${babelConfig}`);
    shell.exec(`npx ${babelBin} ${babelTarget} -d ${babelTarget} --config-file ${babelConfig}`);
};


const CLEANUP = () => {
    changeProjectConfig(true);
};


if (IS_PREPARE) {
    PREPARE();
} else if (IS_CLEANUP) {
    CLEANUP();
}


process.exit();
