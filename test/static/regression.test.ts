import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/index.js';

const FULL_OPTIONS = {
  sources: ['document.cookie', 'location.href', 'location.hash', 'window.name'],
  sinks: ['.innerHTML', '.outerHTML', '$', 'jQuery', 'eval', 'setTimeout'],
};

describe('Regression: Cookie parsing flows', () => {
  /**
   * These tests document a known limitation of static-only analysis:
   * taint cannot propagate through built-in method calls like
   * document.cookie.split() or JSON.parse() because the static engine
   * only tracks taint through user-defined function declarations.
   *
   * The LLM Flow Summary Agent (Phase 2) addresses this by inferring that
   * built-in methods like String.split(), JSON.parse(), etc. propagate taint.
   *
   * STATIC ENGINE: 0 flows detected (expected — can't model built-in semantics)
   * WITH LLM AGENTS: 1+ flows detected (agents infer taint propagation)
   */

  it('parsedCookie1: static engine cannot trace through JSON.parse (needs Flow Summary Agent)', () => {
    const code = `
      var rawNavData = readCookie("s-data");
      var parsedNavData = JSON.parse(rawNavData);
      var usernameLink = document.getElementById("a-username-link");
      usernameLink.innerHTML = parsedNavData.username;
      function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(";");
        for (var i = 0; i < ca.length; i++) {
          var c = ca[i];
          while (c.charAt(0) == " ") c = c.substring(1, c.length);
          if (c.indexOf(nameEQ) == 0) return c;
        }
        return null;
      }
    `;

    const result = analyze(code, FULL_OPTIONS);

    // Static engine: 0 — taint breaks at document.cookie.split() (built-in method call)
    // The readCookie function returns a value derived from document.cookie,
    // but the taint path goes through .split() which isn't a user-defined function.
    expect(result.assignmentPairs.length).toBe(0);
  });

  it('parsedCookie2: static engine cannot trace through string methods (needs Flow Summary Agent)', () => {
    const code = `
      function lookupCookie(name) {
        var parts = document.cookie.split(/\\s*;\\s*/);
        var nameEq = name + "=";
        for (var i = 0; i < parts.length; i++) {
          if (parts[i].indexOf(nameEq) == 0) {
            return parts[i].substr(nameEq.length);
          }
        }
      }
      var payload = lookupCookie("ThisCookieIsTotallyRandomAndCantPossiblyBeSet");
      var div = document.createElement("div");
      div.id = "divEl";
      document.documentElement.appendChild(div);
      var divEl = document.getElementById("divEl");
      divEl.innerHTML = payload;
      function trigger(payload) {
        divEl.innerHTML = payload;
      }
    `;

    const result = analyze(code, FULL_OPTIONS);

    // Static engine: 0 — taint breaks at document.cookie.split() (built-in method)
    // This is exactly the class of vulnerability that SemTaint's Flow Summary Agent solves:
    // it would infer that String.split() propagates taint from receiver to return value.
    expect(result.assignmentPairs.length).toBe(0);
  });

  // Simple direct flows that the static engine DOES catch
  it('direct source → function return → sink works', () => {
    const code = `
      function getHash() { return location.hash; }
      document.body.innerHTML = getHash();
    `;

    const result = analyze(code, {
      sources: ['location.hash'],
      sinks: ['.innerHTML'],
    });

    expect(result.assignmentPairs.length).toBe(1);
    expect(result.assignmentPairs[0]!.source.name).toBe('location.hash');
    expect(result.assignmentPairs[0]!.sink.name).toBe('document.body.innerHTML');
  });

  it('reassigned variable clears taint', () => {
    const code = `
      var x = location.href;
      x = "safe";
      document.body.innerHTML = x;
    `;

    const result = analyze(code, {
      sources: ['location.href'],
      sinks: ['.innerHTML'],
    });

    expect(result.assignmentPairs.length).toBe(0);
  });
});
