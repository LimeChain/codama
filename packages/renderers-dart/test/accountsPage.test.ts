import {
    accountNode,
    camelCase,
    pdaLinkNode,
    programNode,
} from '@codama/nodes';
import { getFromRenderMap } from '@codama/renderers-core';
import { visit } from '@codama/visitors-core';
import { test } from 'vitest';

import { getRenderMapVisitor } from '../src';
import { codeContains } from './_setup';

test('it renders Dart account serialization and ownership', () => {
    // Given the following account.
    const node = programNode({
        accounts: [
            accountNode({
                discriminators: [
                    {
                        kind: 'fieldDiscriminatorNode',
                        name: camelCase('discriminator'),
                        offset: 0,
                    },
                ],
                name: 'testAccount',
                pda: pdaLinkNode('testPda'),
            }),
        ],
        name: 'myProgram',
        publicKey: '1111',
    });

    // When we render it.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect Dart serialization and ownership helpers.
    codeContains(getFromRenderMap(renderMap, 'accounts/test_account.dart'), [
        /class TestAccount\s*{/,
        /static TestAccount fromBorsh\(BinaryReader reader\)/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static TestAccount fromBytes\(Uint8List data\)/,
        /Uint8List toBytes\(\)/,
        /static Future<TestAccount> fetch\(/,
        /static Future<TestAccount\?> fetchNullable\(/,
        /throw AccountNotFoundError\(address\);/,
    ]);
});

test('it renders fetch functions', () => {
    // Given the following account.
    const node = programNode({
        accounts: [
            accountNode({
                discriminators: [
                    {
                        kind: 'fieldDiscriminatorNode',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                        name: camelCase('discriminator'),
                        offset: 0,
                    },
                ],
                name: 'testAccount',
                pda: pdaLinkNode('testPda'),
            }),
        ],
        name: 'myProgram',
        publicKey: '1111',
    });

    // When we render it.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect the following fetch functions to be rendered.
    codeContains(getFromRenderMap(renderMap, 'accounts/test_account.dart'), [
        /class TestAccount\s*{/, // class declaration
        /const List<int>\s+TEST_ACCOUNT_DISCRIMINATOR\s*=\s*\[.*\];/, // discriminator
        /static TestAccount fromBorsh\(BinaryReader reader\)/, // deserialization
        /void toBorsh\(BinaryWriter writer\)/, // serialization
        /static TestAccount fromBytes\(Uint8List data\)/, // fromBytes method
        /Uint8List toBytes\(\)/, // toBytes method
        /static Future<TestAccount> fetch\(/, // fetch method
        /static Future<TestAccount\?> fetchNullable\(/, // fetchNullable method
        /final discriminator = reader\.readDiscriminator\(\);/, // discriminator validation
        /if \(!const ListEquality\(\)\.equals\(discriminator, TEST_ACCOUNT_DISCRIMINATOR\)\)/, // discriminator check
        /throw AccountNotFoundError\(address\);/, // error handling
        /import 'dart:typed_data';/,
        /import 'package:collection\/collection\.dart';/,
        /import 'package:solana\/dto\.dart';/,
        /import 'package:solana\/solana\.dart';/,
        /import '\.\.\/shared\.dart';/,
    ]);
});

