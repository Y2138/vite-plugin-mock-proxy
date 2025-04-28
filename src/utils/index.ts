
// 写一个方法，接收一个 (string | RegExp)[] 参数，和一个 string参数，判断该string是否满足其中一项
export function isMatchUrl(patterns: (string | RegExp)[], str: string): boolean {
  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return pattern === str
    }
    return pattern.test(str);
  });
}

