import {
    arrayTypeNode,
    definedTypeNode,
    numberTypeNode,
    prefixedCountNode,
    publicKeyTypeNode,
    structFieldTypeNode,
    structTypeNode,
} from '@codama/nodes';
import { getFromRenderMap } from '@codama/renderers-core';
import { visit } from '@codama/visitors-core';
import { test } from 'vitest';

import { getRenderMapVisitor } from '../../src';
import { codeContains, codeDoesNotContains } from '../_setup';

test('it exports short vecs', () => {
    // Given an array using a shortU16 prefix.
    const node = definedTypeNode({
        name: 'myShortVec',
        type: arrayTypeNode(publicKeyTypeNode(), prefixedCountNode(numberTypeNode('shortU16'))),
    });

    // When we render the array.
    const renderMap = visit(node, getRenderMapVisitor());
    // Then we expect a Dart class or type for the short vec.
    codeContains(getFromRenderMap(renderMap, 'types/my_short_vec.dart'), [
        /typedef MyShortVec/, // Dart typedef for the array
        /List<Ed25519HDPublicKey>;/, // correct Dart type for the array
        /import 'package:solana\/solana.dart';/, // Dart import for public key
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_short_vec.dart'), [
        /BorshSerialize/, // Rust-specific, should not appear
        /BorshDeserialize/, // Rust-specific, should not appear
        /^use /m, // Rust import, should not appear
    ]);
});

test('it exports short vecs as struct fields', () => {
    // Given an array using a shortU16 prefix.
    const node = definedTypeNode({
        name: 'myShortVec',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: arrayTypeNode(publicKeyTypeNode(), prefixedCountNode(numberTypeNode('shortU16'))),
            }),
        ]),
    });

    // When we render the array.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect a short vec to be exported as a struct field.
    codeContains(getFromRenderMap(renderMap, 'types/my_short_vec.dart'), [
        /class MyShortVec /, // class declaration
        /final List<Ed25519HDPublicKey> value;/, // field declaration
        /MyShortVec\(\s*{\s*required this\.value,\s*}\s*\);/, // constructor
        /extension MyShortVecBorsh on MyShortVec/, // extension for serialization
        /void toBorsh\(BinaryWriter writer\)/, // serialization method
        /static MyShortVec fromBorsh\(BinaryReader reader\)/, // deserialization method
        /import 'package:solana\/solana.dart';/, // solana import
        /import 'dart:typed_data';/, // typed_data import
        /import '\.\.\/shared\.dart';/, // shared import
    ]);
});

test('it exports u8 numbers', () => {
    const node = definedTypeNode({
        name: 'myU8',
        type: numberTypeNode('u8'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /typedef MyU8 = int.*u8/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU8/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports u8 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myU8',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('u8'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /class MyU8 /,
        /final int.*u8.*value;/,
        /required this\.value,/,
        /extension MyU8Borsh on MyU8/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeU8\(value\)/, // serialization line
        /static MyU8 fromBorsh\(BinaryReader reader\)/,
        /reader\.readU8\(\)/, // deserialization line
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU8/, // doc comment
    ]);
});

test('it exports i8 numbers', () => {
    const node = definedTypeNode({
        name: 'myI8',
        type: numberTypeNode('i8'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_i8.dart'), [
        /typedef MyI8 = int.*i8/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI8/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_i8.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports i8 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myI8',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('i8'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_i8.dart'), [
        /class MyI8 /,
        /final int.*i8.*value;/,
        /required this\.value,/,
        /extension MyI8Borsh on MyI8/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeI8\(value\)/,
        /static MyI8 fromBorsh\(BinaryReader reader\)/,
        /reader\.readI8\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI8/,
    ]);
});

test('it exports u16 numbers', () => {
    const node = definedTypeNode({
        name: 'myU16',
        type: numberTypeNode('u16'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u16.dart'), [
        /typedef MyU16 = int.*u16/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU16/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_u16.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports u16 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myU16',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('u16'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u16.dart'), [
        /class MyU16 /,
        /final int.*u16.*value;/,
        /required this\.value,/,
        /extension MyU16Borsh on MyU16/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeU16\(value\)/,
        /static MyU16 fromBorsh\(BinaryReader reader\)/,
        /reader\.readU16\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU16/,
    ]);
});

test('it exports i16 numbers', () => {
    const node = definedTypeNode({
        name: 'myI16',
        type: numberTypeNode('i16'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_i16.dart'), [
        /typedef MyI16 = int.*i16/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI16/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_i16.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports i16 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myI16',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('i16'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_i16.dart'), [
        /class MyI16 /,
        /final int.*i16.*value;/,
        /required this\.value,/,
        /extension MyI16Borsh on MyI16/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeI16\(value\)/,
        /static MyI16 fromBorsh\(BinaryReader reader\)/,
        /reader\.readI16\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI16/,
    ]);
});

test('it exports u32 numbers', () => {
    const node = definedTypeNode({
        name: 'myU32',
        type: numberTypeNode('u32'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u32.dart'), [
        /typedef MyU32 = int.*u32/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU32/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_u32.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports u32 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myU32',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('u32'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u32.dart'), [
        /class MyU32 /,
        /final int.*u32.*value;/,
        /required this\.value,/,
        /extension MyU32Borsh on MyU32/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeU32\(value\)/,
        /static MyU32 fromBorsh\(BinaryReader reader\)/,
        /reader\.readU32\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU32/,
    ]);
});

test('it exports i32 numbers', () => {
    const node = definedTypeNode({
        name: 'myI32',
        type: numberTypeNode('i32'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_i32.dart'), [
        /typedef MyI32 = int.*i32/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI32/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_i32.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports i32 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myI32',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('i32'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_i32.dart'), [
        /class MyI32 /,
        /final int.*i32.*value;/,
        /required this\.value,/,
        /extension MyI32Borsh on MyI32/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeI32\(value\)/,
        /static MyI32 fromBorsh\(BinaryReader reader\)/,
        /reader\.readI32\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI32/,
    ]);
});

test('it exports u64 numbers', () => {
    const node = definedTypeNode({
        name: 'myU64',
        type: numberTypeNode('u64'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u64.dart'), [
        /typedef MyU64 = BigInt.*u64/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU64/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_u64.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports u64 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myU64',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('u64'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u64.dart'), [
        /class MyU64 /,
        /final BigInt.*u64.*value;/,
        /required this\.value,/,
        /extension MyU64Borsh on MyU64/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeU64\(value\)/,
        /static MyU64 fromBorsh\(BinaryReader reader\)/,
        /reader\.readU64\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU64/,
    ]);
});

test('it exports i64 numbers', () => {
    const node = definedTypeNode({
        name: 'myI64',
        type: numberTypeNode('i64'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_i64.dart'), [
        /typedef MyI64 = BigInt.*i64/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI64/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_i64.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports i64 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myI64',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('i64'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_i64.dart'), [
        /class MyI64 /,
        /final BigInt.*i64.*value;/,
        /required this\.value,/,
        /extension MyI64Borsh on MyI64/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeI64\(value\)/,
        /static MyI64 fromBorsh\(BinaryReader reader\)/,
        /reader\.readI64\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI64/,
    ]);
});

test('it exports u128 numbers', () => {
    const node = definedTypeNode({
        name: 'myU128',
        type: numberTypeNode('u128'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u128.dart'), [
        /typedef MyU128 = BigInt.*u128/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU128/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_u128.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports u128 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myU128',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('u128'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u128.dart'), [
        /class MyU128 /,
        /final BigInt.*u128.*value;/,
        /required this\.value,/,
        /extension MyU128Borsh on MyU128/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeBigInt\(value\)/,
        /static MyU128 fromBorsh\(BinaryReader reader\)/,
        /reader\.readBigInt\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU128/,
    ]);
});

test('it exports u128 numbers', () => {
    const node = definedTypeNode({
        name: 'myU128',
        type: numberTypeNode('u128'),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u128.dart'), [
        /typedef MyU128 = BigInt.*u128/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU128/,
    ]);
    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_u128.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports u128 numbers as struct fields', () => {
    const node = definedTypeNode({
        name: 'myU128',
        type: structTypeNode([
            structFieldTypeNode({
                name: 'value',
                type: numberTypeNode('u128'),
            }),
        ]),
    });
    const renderMap = visit(node, getRenderMapVisitor());
    codeContains(getFromRenderMap(renderMap, 'types/my_u128.dart'), [
        /class MyU128 /,
        /final BigInt.*u128.*value;/,
        /required this\.value,/,
        /extension MyU128Borsh on MyU128/,
        /void toBorsh\(BinaryWriter writer\)/,
        /writer\.writeBigInt\(value\)/,
        /static MyU128 fromBorsh\(BinaryReader reader\)/,
        /reader\.readBigInt\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU128/,
    ]);
});