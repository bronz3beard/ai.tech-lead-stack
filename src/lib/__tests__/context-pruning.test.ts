import { pruneStackContext, GEMINI_CACHE_MIN_TOKENS } from '../ai/context-pruning';

describe('context-pruning', () => {
  it('returns raw if length is within maxChars', () => {
    const raw = 'dependencies:\n  next: "13.0.0"';
    expect(pruneStackContext(raw, 1000)).toBe(raw);
  });

  it('hard truncates if maxChars is smaller than the marker length', () => {
    const raw = '01234567890123456789';
    // Marker is 46 chars long. If maxChars is 10:
    const pruned = pruneStackContext(raw, 10);
    expect(pruned).toBe('0123456789');
  });

  it('performs middle-truncation if length exceeds maxChars', () => {
    // Generate a long string
    const raw = 'A'.repeat(500) + 'B'.repeat(500); // 1000 chars

    // Prune to 100 chars
    const pruned = pruneStackContext(raw, 100);
    
    expect(pruned.length).toBeLessThanOrEqual(100);
    expect(pruned).toContain('...[Context truncated due to length]...');
    // Should contain some As at the start and some Bs at the end
    expect(pruned.startsWith('AAAA')).toBe(true);
    expect(pruned.endsWith('BBBB')).toBe(true);
  });

  describe('handles common config files for top 15 programming languages (TIOBE)', () => {
    const configs = [
      {
        language: 'Python',
        name: 'pyproject.toml',
        content: `[tool.poetry]\nname = "my-python-app"\nversion = "0.1.0"\n` + `\n`.repeat(50) + `[build-system]\nrequires = ["poetry-core"]\n`
      },
      {
        language: 'C/C++',
        name: 'CMakeLists.txt',
        content: `cmake_minimum_required(VERSION 3.10)\nproject(MyCppApp)\n` + `\n`.repeat(50) + `add_executable(MyCppApp main.cpp)\n`
      },
      {
        language: 'Java',
        name: 'pom.xml',
        content: `<project>\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.mycompany.app</groupId>\n` + `\n`.repeat(50) + `  <build></build>\n</project>`
      },
      {
        language: 'C#',
        name: 'Project.csproj',
        content: `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n  </PropertyGroup>\n` + `\n`.repeat(50) + `  <ItemGroup>\n    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />\n  </ItemGroup>\n</Project>`
      },
      {
        language: 'JavaScript',
        name: 'package.json',
        content: `{\n  "name": "my-js-app",\n  "version": "1.0.0",\n` + `\n`.repeat(50) + `  "dependencies": {\n    "express": "^4.18.2"\n  }\n}`
      },
      {
        language: 'Visual Basic',
        name: 'Project.vbproj',
        content: `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n` + `\n`.repeat(50) + `    <RootNamespace>MyVbApp</RootNamespace>\n  </PropertyGroup>\n</Project>`
      },
      {
        language: 'SQL',
        name: 'schema.sql',
        content: `CREATE TABLE users (\n  id INT PRIMARY KEY,\n  username VARCHAR(50)\n);\n` + `\n`.repeat(50) + `CREATE INDEX idx_users_username ON users (username);\n`
      },
      {
        language: 'R',
        name: 'DESCRIPTION',
        content: `Package: myRpackage\nTitle: What the Package Does\nVersion: 0.1.0\n` + `\n`.repeat(50) + `Depends: R (>= 2.10)\nLicense: MIT\n`
      },
      {
        language: 'Rust',
        name: 'Cargo.toml',
        content: `[package]\nname = "my-rust-app"\nversion = "0.1.0"\n` + `\n`.repeat(50) + `[dependencies]\nserde = "1.0"\n`
      },
      {
        language: 'Delphi/Object Pascal',
        name: 'Project.dproj',
        content: `<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">\n  <PropertyGroup>\n` + `\n`.repeat(50) + `  </PropertyGroup>\n</Project>`
      },
      {
        language: 'Scratch',
        name: 'project.json',
        content: `{\n  "targets": [\n    {\n      "isStage": true,\n` + `\n`.repeat(50) + `      "name": "Stage"\n    }\n  ]\n}`
      },
      {
        language: 'PHP',
        name: 'composer.json',
        content: `{\n  "name": "my/php-app",\n  "description": "A PHP app"\n` + `\n`.repeat(50) + `  "require": {\n    "monolog/monolog": "^2.0"\n  }\n}`
      },
      {
        language: 'Go',
        name: 'go.mod',
        content: `module github.com/my/go-app\n\ngo 1.21\n` + `\n`.repeat(50) + `require (\n\tgithub.com/gin-glex/gin v1.9.1\n)\n`
      },
      {
        language: 'Fortran',
        name: 'fpm.toml',
        content: `name = "my-fortran-app"\nversion = "0.1.0"\n` + `\n`.repeat(50) + `[dependencies]\nstdlib = "*"\n`
      }
    ];

    configs.forEach(({ language, name, content }) => {
      it(`handles ${language} (${name})`, () => {
        // Under maxChars
        expect(pruneStackContext(content, 1000)).toBe(content);
        
        // Over maxChars
        const maxChars = 100;
        const pruned = pruneStackContext(content, maxChars);
        
        expect(pruned.length).toBeLessThanOrEqual(maxChars);
        
        const marker = '\n\n...[Context truncated due to length]...\n\n';
        expect(pruned).toContain(marker);
        
        const parts = pruned.split(marker);
        expect(parts).toHaveLength(2);
        
        // Assert that the preserved head and tail match the original string's start and end
        expect(content.startsWith(parts[0])).toBe(true);
        expect(content.endsWith(parts[1])).toBe(true);
      });
    });
  });

  describe('preserveForCache (Gemini implicit caching)', () => {
    it('does not prune below GEMINI_CACHE_MIN_TOKENS when preserveForCache is true', () => {
      // Create a string that is > GEMINI_CACHE_MIN_TOKENS tokens
      const rawChars = (GEMINI_CACHE_MIN_TOKENS + 1000) * 4;
      const raw = 'A'.repeat(rawChars); 
      
      // maxChars is 100, which is normally very small
      const pruned = pruneStackContext(raw, 100, true);
      
      // But it should preserve at least GEMINI_CACHE_MIN_TOKENS * 4 chars (minus 1 due to math.floor rounding)
      expect(pruned.length).toBeGreaterThanOrEqual(GEMINI_CACHE_MIN_TOKENS * 4 - 1);
    });

    it('prunes normally when preserveForCache is false', () => {
      const rawChars = (GEMINI_CACHE_MIN_TOKENS + 1000) * 4;
      const raw = 'A'.repeat(rawChars); 
      const pruned = pruneStackContext(raw, 100, false);
      expect(pruned.length).toBeLessThanOrEqual(100);
    });
  });
});
