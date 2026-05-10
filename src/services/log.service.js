/**
 * 操作日志服务层
 * @author 樊高工
 */
const logDao = require('../dao/log.dao');

class LogService {
  /**
   * 日志列表（分页 + 筛选）
   */
  async list({ page, pageSize, userId, action, startTime, endTime }) {
    pageSize = [10, 20, 50].includes(pageSize) ? pageSize : 20;
    page = Math.max(1, page);
    
    const result = await logDao.findPage({ page, pageSize, userId, action, startTime, endTime });
    
    // 解析 detail JSON
    result.list = result.list.map(item => ({
      ...item,
      detail: typeof item.detail === 'string' ? JSON.parse(item.detail) : item.detail
    }));
    
    return result;
  }
}

module.exports = new LogService();