<template>
    <div>
        <h3>随机数生成器</h3>
        <p>点击按钮生成一个 0 到 100 之间的随机数。</p>
        <button @click="generate">生成随机数</button>
        <h4 v-if="randomNumber !== null">结果: {{ randomNumber }}</h4>
    </div>
</template>

<script>
export default {
    data() {
        return {
            randomNumber: null
        };
    },
    methods: {
        generate() {
            this.randomNumber = Math.floor(Math.random() * 101);
        }
    }
};
</script>
