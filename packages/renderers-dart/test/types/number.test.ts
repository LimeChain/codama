import { definedTypeNode, numberTypeNode, structFieldTypeNode, structTypeNode } from '@codama/nodes';
import { getFromRenderMap } from '@codama/renderers-core';
import { visit } from '@codama/visitors-core';
import { test } from 'vitest';

import { getRenderMapVisitor } from '../../src';
import { codeContains, codeDoesNotContains } from '../_setup';

test('it exports short u16 numbers', () => {
    // Given a shortU16 number.
    const node = definedTypeNode({
        name: 'myShortU16',
        type: numberTypeNode('shortU16'),
    });

    // When we render the number.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect a short u16 to be exported.
    codeContains(getFromRenderMap(renderMap, 'types/my_short_u16.dart'), [
        /typedef MyShortU16 = int.*shortU16/, // Dart typedef with comment
        /import 'dart:typed_data';/,         // Dart import
        /import '\.\.\/shared\.dart';/,      // Dart import
        /Generated type definition for MyShortU16/, // doc comment
    ]);

    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_short_u16.dart'), [
        /BorshSerialize/, // Rust-specific, should not appear
        /BorshDeserialize/, // Rust-specific, should not appear
        /^use /m, // Rust import, should not appear
    ]);
});

test('it exports short u16 numbers as struct fields', () => {
    // Given a shortU16 number.
    const node = definedTypeNode({
        name: 'myShortU16',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('shortU16') })]),
    });

    // When we render the number.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect a short u16 to be exported as a struct field.
    codeContains(getFromRenderMap(renderMap, 'types/my_short_u16.dart'), [
        /class MyShortU16 /, // class declaration
        /final int.*shortU16.*value;/, // field declaration with type comment
        /MyShortU16\(\s*{\s*required this\.value,\s*}\s*\);/, // constructor
        /extension MyShortU16Borsh on MyShortU16/, // extension for serialization
        /void toBorsh\(BinaryWriter writer\)/, // serialization method
        /static MyShortU16 fromBorsh\(BinaryReader reader\)/, // deserialization method
        /throw Exception\('Unsupported number format: shortU16'\);/, // error for unsupported format
        /import 'dart:typed_data';/, // Dart import
        /import '\.\.\/shared\.dart';/, // shared import
        /Generated type definition for MyShortU16/, // doc comment
    ]);
});

test('it exports u8 numbers', () => {
    // Given a u8 number.
    const node = definedTypeNode({
        name: 'myU8',
        type: numberTypeNode('u8'),
    });

    // When we render the number.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect a u8 to be exported.
    codeContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /typedef MyU8 = int.*u8/, // Dart typedef with comment
        /import 'dart:typed_data';/, // Dart import
        /import '\.\.\/shared\.dart';/, // Dart import
        /Generated type definition for MyU8/, // doc comment
    ]);

    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /BorshSerialize/, // Rust-specific, should not appear
        /BorshDeserialize/, // Rust-specific, should not appear
        /^use /m, // Rust import, should not appear
    ]);
});

test('it exports u8 numbers as struct fields', () => {
    // Given a u8 number.
    const node = definedTypeNode({
        name: 'myU8',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u8') })]),
    });

    // When we render the number.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect a u8 to be exported as a struct field.
    codeContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /class MyU8 /, // class declaration
        /final int.*u8.*value;/, // field declaration with type comment
        /MyU8\(\s*{\s*required this\.value,\s*}\s*\);/, // constructor
        /extension MyU8Borsh on MyU8/, // extension for serialization
        /void toBorsh\(BinaryWriter writer\)/, // serialization method
        /static MyU8 fromBorsh\(BinaryReader reader\)/, // deserialization method
        /writer\.writeU8\(value\)/, // serialization line
        /reader\.readU8\(\)/, // deserialization line
        /import 'dart:typed_data';/, // Dart import
        /import '\.\.\/shared\.dart';/, // shared import
        /Generated type definition for MyU8/, // doc comment
    ]);
});

test('it exports u8 numbers', () => {
    // Given a u8 number.
    const node = definedTypeNode({
        name: 'myU8',
        type: numberTypeNode('u8'),
    });

    // When we render the number.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect a u8 to be exported.
    codeContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /typedef MyU8 = int.*u8/, // Dart typedef with comment
        /import 'dart:typed_data';/, // Dart import
        /import '\.\.\/shared\.dart';/, // Dart import
        /Generated type definition for MyU8/, // doc comment
    ]);

    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /BorshSerialize/, // Rust-specific, should not appear
        /BorshDeserialize/, // Rust-specific, should not appear
        /^use /m, // Rust import, should not appear
    ]);
});

test('it exports u8 numbers as struct fields', () => {
    // Given a u8 number.
    const node = definedTypeNode({
        name: 'myU8',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u8') })]),
    });

    // When we render the number.
    const renderMap = visit(node, getRenderMapVisitor());

    // Then we expect a u8 to be exported as a struct field.
    codeContains(getFromRenderMap(renderMap, 'types/my_u8.dart'), [
        /class MyU8 /, // class declaration
        /final int.*u8.*value;/, // field declaration with type comment
        /MyU8\(\s*{\s*required this\.value,\s*}\s*\);/, // constructor
        /extension MyU8Borsh on MyU8/, // extension for serialization
        /void toBorsh\(BinaryWriter writer\)/, // serialization method
        /static MyU8 fromBorsh\(BinaryReader reader\)/, // deserialization method
        /writer\.writeU8\(value\)/, // serialization line
        /reader\.readU8\(\)/, // deserialization line
        /import 'dart:typed_data';/, // Dart import
        /import '\.\.\/shared\.dart';/, // shared import
        /Generated type definition for MyU8/, // doc comment
    ]);
});

test('it exports u16 numbers', () => {
    // Given a u16 number.
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
    // Given a u16 number.
    const node = definedTypeNode({
        name: 'myU16',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u16') })]),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_u16.dart'), [
        /class MyU16 /,
        /final int.*u16.*value;/,
        /MyU16\(\s*{\s*required this\.value,\s*}\s*\);/,
        /extension MyU16Borsh on MyU16/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static MyU16 fromBorsh\(BinaryReader reader\)/,
        /writer\.writeU16\(value\)/,
        /reader\.readU16\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU16/,
    ]);
});

test('it exports u16 numbers', () => {
    // Given a u16 number.
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
    // Given a u16 number.
    const node = definedTypeNode({
        name: 'myU16',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u16') })]),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_u16.dart'), [
        /class MyU16 /,
        /final int.*u16.*value;/,
        /MyU16\(\s*{\s*required this\.value,\s*}\s*\);/,
        /extension MyU16Borsh on MyU16/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static MyU16 fromBorsh\(BinaryReader reader\)/,
        /writer\.writeU16\(value\)/,
        /reader\.readU16\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU16/,
    ]);
});

test('it exports u32 numbers', () => {
    // Given a u32 number.
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
    // Given a u32 number.
    const node = definedTypeNode({
        name: 'myU32',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u32') })]),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_u32.dart'), [
        /class MyU32 /,
        /final int.*u32.*value;/,
        /MyU32\(\s*{\s*required this\.value,\s*}\s*\);/,
        /extension MyU32Borsh on MyU32/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static MyU32 fromBorsh\(BinaryReader reader\)/,
        /writer\.writeU32\(value\)/,
        /reader\.readU32\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU32/,
    ]);
});

test('it exports i32 numbers', () => {
    // Given an i32 number.
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
    // Given an i32 number.
    const node = definedTypeNode({
        name: 'myI32',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('i32') })]),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_i32.dart'), [
        /class MyI32 /,
        /final int.*i32.*value;/,
        /MyI32\(\s*{\s*required this\.value,\s*}\s*\);/,
        /extension MyI32Borsh on MyI32/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static MyI32 fromBorsh\(BinaryReader reader\)/,
        /writer\.writeI32\(value\)/,
        /reader\.readI32\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI32/,
    ]);
});

test('it exports u64 numbers', () => {
    // Given a u64 number.
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
    // Given a u64 number.
    const node = definedTypeNode({
        name: 'myU64',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u64') })]),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_u64.dart'), [
        /class MyU64 /,
        /final BigInt.*u64.*value;/,
        /MyU64\(\s*{\s*required this\.value,\s*}\s*\);/,
        /extension MyU64Borsh on MyU64/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static MyU64 fromBorsh\(BinaryReader reader\)/,
        /writer\.writeU64\(value\)/,
        /reader\.readU64\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU64/,
    ]);
});

test('it exports i64 numbers', () => {
    // Given an i64 number.
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
    // Given an i64 number.
    const node = definedTypeNode({
        name: 'myI64',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('i64') })]),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_i64.dart'), [
        /class MyI64 /,
        /final BigInt.*i64.*value;/,
        /MyI64\(\s*{\s*required this\.value,\s*}\s*\);/,
        /extension MyI64Borsh on MyI64/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static MyI64 fromBorsh\(BinaryReader reader\)/,
        /writer\.writeI64\(value\)/,
        /reader\.readI64\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI64/,
    ]);
});


test('it exports u128 numbers', () => {
    // Given a u128 number.
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
    // Given a u128 number.
    const node = definedTypeNode({
        name: 'myU128',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u128') })]),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_u128.dart'), [
        /class MyU128 /,
        /final BigInt.*u128.*value;/,
        /MyU128\(\s*{\s*required this\.value,\s*}\s*\);/,
        /extension MyU128Borsh on MyU128/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static MyU128 fromBorsh\(BinaryReader reader\)/,
        /writer\.writeBigInt\(value\)/,
        /reader\.readBigInt\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyU128/,
    ]);
});

test('it exports i128 numbers', () => {
    // Given an i128 number.
    const node = definedTypeNode({
        name: 'myI128',
        type: numberTypeNode('i128'),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_i128.dart'), [
        /typedef MyI128 = BigInt.*i128/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI128/,
    ]);

    codeDoesNotContains(getFromRenderMap(renderMap, 'types/my_i128.dart'), [
        /BorshSerialize/,
        /BorshDeserialize/,
        /^use /m,
    ]);
});

test('it exports i128 numbers as struct fields', () => {
    // Given an i128 number.
    const node = definedTypeNode({
        name: 'myI128',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('i128') })]),
    });

    const renderMap = visit(node, getRenderMapVisitor());

    codeContains(getFromRenderMap(renderMap, 'types/my_i128.dart'), [
        /class MyI128 /,
        /final BigInt.*i128.*value;/,
        /MyI128\(\s*{\s*required this\.value,\s*}\s*\);/,
        /extension MyI128Borsh on MyI128/,
        /void toBorsh\(BinaryWriter writer\)/,
        /static MyI128 fromBorsh\(BinaryReader reader\)/,
        /writer\.writeBigInt\(value\)/,
        /reader\.readBigInt\(\)/,
        /import 'dart:typed_data';/,
        /import '\.\.\/shared\.dart';/,
        /Generated type definition for MyI128/,
    ]);
});