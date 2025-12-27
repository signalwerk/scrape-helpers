import fs from "fs";
import path from "path";
import { fsCacheNameOfUri } from "./fsNameOfUri.js";
import { writeFile } from "./writeFile.js";

export class Cache {
  constructor(baseDir = "./DATA/SOURCE") {
    this.baseDir = baseDir;
  }

  async set(key, { metadata, data }) {
    const filePath = path.resolve(this.baseDir, fsCacheNameOfUri(key));
    const metaFilePath = `${filePath}.json`;
    const rawFilePath = `${filePath}.raw`;

    await writeFile(
      metaFilePath,
      JSON.stringify({ metadata, hasData: !!data }, null, 2),
    );

    if (data) {
      await writeFile(rawFilePath, data);
    }
  }

  has(key) {
    const metaFilePath = path.resolve(
      this.baseDir,
      `${fsCacheNameOfUri(key)}.json`,
    );
    return fs.existsSync(metaFilePath);
  }

  getRawMetadata(key) {
    const metaFilePath = path.resolve(
      this.baseDir,
      `${fsCacheNameOfUri(key)}.json`,
    );
    if (!fs.existsSync(metaFilePath)) {
      throw new Error(`Metadata file not found: ${metaFilePath}`);
    }
    return JSON.parse(fs.readFileSync(metaFilePath, "utf8"));
  }

  getMetadata(key) {
    const meta = this.getRawMetadata(key);
    return meta.metadata;
  }

  getData(key) {
    const filePath = path.resolve(this.baseDir, fsCacheNameOfUri(key));
    const rawFilePath = `${filePath}.raw`;

    if (fs.existsSync(rawFilePath)) {
      return fs.readFileSync(rawFilePath);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Data file not found: ${rawFilePath}`);
    }

    return fs.readFileSync(filePath);
  }

  get(key) {
    if (!this.has(key)) {
      return null;
    }

    const { metadata, hasData } = this.getRawMetadata(key);

    return {
      metadata,
      data: hasData ? this.getData(key) : null,
    };
  }

  clear() {
    fs.rmSync(this.baseDir, { recursive: true, force: true });
  }
}
