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
  narrative?: string;      // 故事引入和解释性叙述
  keyTakeaways?: string[];  // 关键要点总结
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
      narrative: this.extractNarrative(content),
      keyTakeaways: this.extractKeyTakeaways(content),
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

  // 提取故事引入和解释性叙述（问题背景、解决方案思路）
  private extractNarrative(markdown: string): string {
    // 提取从开头到"## 核心概念"之前的内容作为叙述
    // 兼容 markdown 开头有元数据链接的情况
    const match = markdown.match(/(^#\s+.+[\s\S]*?)(?=## 核心概念)/m);
    if (match) {
      let narrative = match[1].trim();
      // 移除链接引用
      narrative = narrative.replace(/\[English Version.*?\]\(.*?\)/g, '');
      narrative = narrative.replace(/本篇代码示例.*?\n>/g, '');
      narrative = narrative.replace(/实战练习.*?\n>/g, '');
      return narrative.trim();
    }
    return '';
  }

  // 提取关键要点（## 关键要点章节的内容）
  private extractKeyTakeaways(markdown: string): string[] {
    const takeaways: string[] = [];
    const sectionMatch = markdown.match(/## 关键要点\n\n([\s\S]*?)(?=\n## |$)/);

    if (sectionMatch) {
      const content = sectionMatch[1];
      // 提取列表项（- 开头的行）
      const bulletMatches = content.matchAll(/[-*]\s+(.+)/g);
      for (const match of bulletMatches) {
        takeaways.push(match[1].trim());
      }
    }

    return takeaways;
  }

  async getLectureWithTeachingPoints(lectureId: string): Promise<LectureWithPoints | null> {
    const lecture = await this.getLecture(lectureId);
    if (!lecture) return null;

    // 从课程内容中提取 teaching points
    // 这里简化处理，实际可以从单独的文件读取
    const teachingPoints = this.extractTeachingPoints(lecture.content, lecture.concepts);

    return {
      ...lecture,
      teachingPoints
    };
  }

  private extractTeachingPoints(content: string, concepts: string[]): TeachingPoint[] {
    // 从概念列表中解析出 teaching points
    // concepts 格式："概念名：定义"
    return concepts.map(conceptEntry => {
      const colonIndex = conceptEntry.indexOf('：');
      const concept = colonIndex > 0 ? conceptEntry.substring(0, colonIndex) : conceptEntry;
      const explanation = colonIndex > 0 ? conceptEntry.substring(colonIndex + 1) : '';

      // 生成验证问题（第一层：理解检查）
      const question = `你能用自己的话说说"${concept}"是什么意思吗？`;

      return {
        concept,
        explanation,
        example: '',  // 例子从正文中查找，这里先留空
        question
      };
    });
  }
}

// 讲解要点
export interface TeachingPoint {
  concept: string;      // 核心概念
  explanation: string;  // 通俗解释
  example: string;      // 例子
  question: string;     // 验证问题
}

export interface LectureWithPoints {
  id: string;
  title: string;
  content: string;
  concepts: string[];
  narrative?: string;       // 故事引入和解释性叙述
  keyTakeaways?: string[];  // 关键要点
  order: number;
  teachingPoints: TeachingPoint[];
}