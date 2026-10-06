# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TanStack Start with React and TypeScript.

## Users

People who want a simple way to remove embedded image metadata before sharing an image on social platforms such as Instagram.

## Product Purpose

Let a user inspect an image, remove standard embedded metadata in their browser, preview the cleaned result, and download a new file. A separate scan workflow evaluates available provenance and metadata signals and explains whether they suggest AI generation. Success means the user can complete either workflow without uploading the image to a server.

## Positioning

The product makes the cleanup visible: it shows what metadata was found, processes the image locally, and makes clear which signals metadata removal can and cannot affect.

## Operating Context

The app has two primary tabs. “Clean metadata” lets a user select or drag in an image, review discovered metadata, clean it, and download the resulting image before posting elsewhere. “Scan AI signals” lets a user inspect a separate image and receive an evidence-based likelihood result with the supporting signals listed.

## Capabilities and Constraints

- Remove standard metadata by decoding and re-encoding supported image formats in the browser.
- Display basic file facts and common metadata fields when they can be read.
- Support JPEG, PNG, and WebP inputs.
- Keep image processing local to the browser.
- Scan metadata, provenance markers, embedded software names, comments, and limited image heuristics for signals associated with AI generation or editing.
- Present scan results as “signals found,” “no signals found,” or “inconclusive,” with a confidence explanation rather than an unsupported binary guarantee.
- Do not claim to remove every provenance mechanism or to bypass platform-side AI classifiers, perceptual analysis, or other detection methods.
- Cryptographically signed provenance such as C2PA may require dedicated validation and cannot be represented as defeated by this product.
- Absence of AI-related metadata is not proof that an image is human-made, and the interface must state that clearly.

## Evidence on Hand

No testimonials, performance benchmarks, partner claims, or third-party certifications have been supplied. Future work must not fabricate them.

## Product Principles

- Local by default: image contents should not leave the browser.
- Show the work: explain what was found and what changed.
- Evidence before verdict: every AI-signal result names the observations behind it.
- Honest scope: distinguish metadata removal from AI-content detection.
- One clear path: upload, inspect, clean, download.

## Accessibility & Inclusion

The primary workflow must be keyboard accessible, have visible focus states, and avoid relying on color alone for status.
