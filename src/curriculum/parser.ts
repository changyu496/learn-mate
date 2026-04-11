export interface LearningNode {
  id: string;
  lectureId: string;
  title: string;
  concepts: string[];
  content: string;
  examples: {
    python?: string;
    java?: string;
    javascript?: string;
    go?: string;
  };
  completedCriteria: string;
}

export interface Lecture {
  id: string;
  title: string;
  content: string;
  concepts: string[];
  order: number;
}

import * as fs from 'fs';
import * as path from 'path';

export class CurriculumParser {
  private coursePath: string;

  constructor(coursePath: string) {
    this.coursePath = coursePath;
  }

  async getLectureList(): Promise<Array<{ id: string; title: string; order: number }>> {
    const entries = await fs.promises.readdir(this.coursePath);
    const lectureDirs = entries
      .filter(name => name.startsWith('lecture-'))
      .sort();

    const lectures: Array<{ id: string; title: string; order: number }> = [];

    for (let i = 0; i < lectureDirs.length; i++) {
      const dirName = lectureDirs[i];
      const indexPath = path.join(this.coursePath, dirName, 'index.md');

      if (fs.existsSync(indexPath)) {
        const content = await fs.promises.readFile(indexPath, 'utf-8');
        const title = this.extractTitle(content);
        lectures.push({
          id: dirName,
          title,
          order: i + 1
        });
      }
    }

    return lectures;
  }

  async getLecture(lectureId: string): Promise<Lecture | null> {
    const lecturePath = path.join(this.coursePath, lectureId, 'index.md');

    if (!fs.existsSync(lecturePath)) {
      return null;
    }

    const content = await fs.promises.readFile(lecturePath, 'utf-8');
    const lectures = await this.getLectureList();
    const lectureMeta = lectures.find(l => l.id === lectureId);

    return {
      id: lectureId,
      title: this.extractTitle(content),
      content: this.extractCoreContent(content),
      concepts: this.extractConcepts(content),
      order: lectureMeta?.order || 0
    };
  }

  async getAllLectures(): Promise<Lecture[]> {
    const list = await this.getLectureList();
    const lectures: Lecture[] = [];

    for (const meta of list) {
      const lecture = await this.getLecture(meta.id);
      if (lecture) {
        lectures.push(lecture);
      }
    }

    return lectures.sort((a, b) => a.order - b.order);
  }

  private extractTitle(markdown: string): string {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled';
  }

  private extractCoreContent(markdown: string): string {
    // Remove YAML frontmatter
    let content = markdown.replace(/^---[\s\S]*?---\n/, '');
    // Remove English version link
    content = content.replace(/\[English Version.*?\]\(.*?\)/g, '');
    // Remove code block references
    content = content.replace(/```[\s\S]*?```/g, '');
    // Remove links but keep text
    content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Remove images
    content = content.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
    // Remove headers from content (keep h1 as title already extracted)
    content = content.replace(/^#{1,6}\s+/gm, '');
    // Normalize whitespace
    content = content.replace(/\n{3,}/g, '\n\n');
    return content.trim();
  }

  private extractConcepts(markdown: string): string[] {
    const concepts: string[] = [];
    const sectionMatch = markdown.match(/## 核心概念\n\n([\s\S]*?)(?=\n##|$)/);

    if (sectionMatch) {
      const conceptText = sectionMatch[1];
      const bulletMatches = conceptText.matchAll(/[-*]\s+\*\*([^*]+)\*\*[：:]\s*(.+)/g);

      for (const match of bulletMatches) {
        concepts.push(`${match[1]}: ${match[2]}`);
      }
    }

    return concepts;
  }
}