import mongoose from 'mongoose';
import { LabTest } from '../models/LabTest.js';

/**
 * Resolves catalog testIds or legacy free-text test_requests into LabOrder fields.
 * @returns {Promise<{ requested_tests: { test: import('mongoose').Types.ObjectId }[], test_requests: string[], error?: string }>}
 */
export async function resolveRequestedTestsFromBody(body) {
  const testIds = Array.isArray(body.testIds) ? body.testIds : [];
  const seen = new Set();
  const validIds = [];
  for (const raw of testIds) {
    const id = String(raw);
    if (!mongoose.isValidObjectId(id) || seen.has(id)) continue;
    seen.add(id);
    validIds.push(id);
  }
  if (validIds.length) {
    const tests = await LabTest.find({ _id: { $in: validIds } }).lean();
    if (tests.length !== validIds.length) {
      return { requested_tests: [], test_requests: [], error: 'One or more testIds are invalid' };
    }
    const byId = Object.fromEntries(tests.map((t) => [String(t._id), t]));
    const ordered = validIds.map((id) => byId[id]).filter(Boolean);
    return {
      requested_tests: ordered.map((t) => ({ test: t._id })),
      test_requests: ordered.map((t) => t.name),
    };
  }

  let tests = body.test_requests;
  if (!Array.isArray(tests)) {
    if (typeof tests === 'string') {
      tests = tests
        .split(/[\n,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      return { requested_tests: [], test_requests: [], error: 'Provide testIds or test_requests' };
    }
  }
  const cleaned = tests.map((t) => String(t).trim()).filter(Boolean);
  if (!cleaned.length) {
    return { requested_tests: [], test_requests: [], error: 'At least one test is required' };
  }
  return { requested_tests: [], test_requests: cleaned };
}
