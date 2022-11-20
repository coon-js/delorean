# `@coon-js/delorean`

Utility script for transpiling Sencha Ext JS to ES 5 during the build process.

## Usage

Install **@coon-js/delorean** with 

```bash
$ npm i --save-dev @coon-js/delorean
```

Next, you need to adjust the `before-build` target for the Sencha CMD
exec.

Add the following to your `.build.xml` in the
root of your Sencha Ext JS app or package:

```xml
<target name="-before-build">
    <exec executable="cmd">
        <arg line="/c npx delorean --prepare --src .src .app .classic"/>
    </exec>
</target>

<target name="-after-build">
    <exec executable="cmd">
        <arg line="/c npx delorean --cleanup --src .src .app .classic"/>
    </exec>
</target>
```

### `--prepare`
Will make sure that the sources from the specified src files are copied to a backup folder before transpiling occurs.

### `--cleanup`
Copies the files from the specified sources in the backup folder back to the root dir.


`.src` `.app` and `.classic` are the directories that should be considered by
the **babel** transpiler. Adjust to your needs.

#### Note
The sources will get transpiled directly in their source folders,
the changes will be reverted afterwards. Please make sure you are using
a SCM so you're able to revert any changes manually.

A copy of the most recent sources processed by **@coon-js/delorean** 
will be available in `.delorean`.


### Flaws
Transpiling does not work with external packages that should be considered
during the build, e.g. local packages, even if the packages themself use
**@coon-js/deloarean**.
