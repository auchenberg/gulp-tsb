/// <reference path="../node_modules/typescript/lib/lib.es6.d.ts"/>

'use strict';

import vinyl = require('vinyl');
import * as through from 'through';
import * as clone from 'clone';
import * as builder from './builder';
import {readConfigFile} from 'typescript';
import {Stream} from 'stream';
import {readFileSync} from 'fs';

export function create(configOrName: builder.IConfiguration|string, verbose?: boolean, json?: boolean, onError?: (message: any) => void): () => Stream {

    var config: builder.IConfiguration;
    if (typeof configOrName === 'string') {
        var parsed = readConfigFile(configOrName, (path) => readFileSync(path, undefined));
        if (parsed.error) {
            console.error(parsed.error);
            return () => null;
        }
        config = parsed.config.compilerOptions;

    } else {
        // clone the configuration
        config = clone(configOrName);
    }

    // add those
    config.verbose = config.verbose || verbose;
    config.json = config.json || json;

    if (!onError) {
        onError = (err) => console.log(JSON.stringify(err, null, 4));
    }

    var _builder = builder.createTypeScriptBuilder(config);

    function createStream(token?: builder.CancellationToken): Stream {

        return through(function (file: vinyl) {
            // give the file to the compiler
            if (file.isStream()) {
                this.emit('error', 'no support for streams');
                return;
            }
            _builder.file(file);
        }, function () {
            // start the compilation process
            _builder.build(file => this.queue(file), onError, token).then(() => this.queue(null));
        });
    }

    return (token?: builder.CancellationToken) => createStream(token);
}
