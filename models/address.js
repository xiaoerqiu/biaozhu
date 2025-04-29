const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    name: {
        type: String,
        default: '未命名',
        trim: true
    },
    address: {
        type: String,
        required: [true, '地址不能为空'],
        trim: true,
        index: true
    },
    type: {
        type: String,
        trim: true
    },
    contact: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                return /^1[3-9]\d{9}$/.test(v) || !v;
            },
            message: props => `${props.value} 不是有效的手机号码`
        }
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            index: '2dsphere'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    versionKey: false
});

// 更新时间中间件
addressSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// 创建复合索引
addressSchema.index({ address: 1, createdAt: -1 });

// 添加静态方法
addressSchema.statics.findByAddress = function(address) {
    return this.findOne({ address: new RegExp(address, 'i') });
};

// 添加实例方法
addressSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
};

module.exports = mongoose.model('Address', addressSchema);